/**
 * scripts/fill-clinic-providers.ts — backfill PROVIDERS (staff) for clinics that
 * currently show none. The clinic page only renders providers WITH a headshot,
 * so a clinic looks empty unless ≥1 provider has a photo. This scrapes each
 * clinic's team/about page and extracts providers via OpenAI (gpt-4o-mini,
 * text-only → cheap), then upserts them owner-first.
 *
 * Owner-first is encoded exactly as the pipeline does: the owner is the one
 * provider whose `card_tagline` is non-null (the page floats them first via
 * ORDER BY (card_tagline IS NOT NULL) DESC, name). Everyone else = null.
 *
 * NEVER deletes or overwrites good data: fills image_url on rows that lack it,
 * adds the owner tagline, inserts genuinely new people. Min 1 / max 10 per
 * clinic; clinics with no extractable headshot provider are skipped. The
 * ingestion pipeline is untouched — this only reuses its read-only helpers.
 *
 *   bun scripts/fill-clinic-providers.ts                    # preview ALL (no writes)
 *   bun scripts/fill-clinic-providers.ts --clinic=<slug|id> # one clinic
 *   bun scripts/fill-clinic-providers.ts --limit=8          # first N
 *   bun scripts/fill-clinic-providers.ts --zero-only        # only 0-provider clinics
 *   bun scripts/fill-clinic-providers.ts --photoless-only   # only has-providers-no-photo
 *   bun scripts/fill-clinic-providers.ts --apply            # write
 */
import "dotenv/config";
import pool, { query } from "../src/lib/db";
import { fetchHtml, load, BROWSER_UA } from "../src/lib/scraper/utils";
import { discoverContentPages } from "../src/lib/ingest/discover";
import { collectImageCandidates } from "../src/lib/scraper/images";
import { extractViaOpenAI } from "../src/lib/ai/openai";

const APPLY = process.argv.includes("--apply");
const ZERO_ONLY = process.argv.includes("--zero-only");
const PHOTOLESS_ONLY = process.argv.includes("--photoless-only");
const clinicArg = process.argv.find((a) => a.startsWith("--clinic="))?.split("=")[1];
const limitArg = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 0;
const CONCURRENCY = 5;
const CAP = 10;

const TEAMISH = /team|staff|provider|about|meet|practitioner|injector|doctor|our-people|founder/i;

interface Clinic { id: string; name: string; slug: string; website: string; has_any: boolean; }
interface AiProvider { name: string; title: string | null; image_url: string | null; card_tagline: string | null; is_owner: boolean; }
interface ExistingRow { id: string; name: string; title: string | null; image_url: string | null; card_tagline: string | null; }

/** Normalize a provider name for matching: lowercase, drop credentials after a
 *  comma, strip a leading "dr", remove punctuation, collapse whitespace. */
function normName(n: string): string {
  return n.split(",")[0]
    .toLowerCase()
    .replace(/\b(dr|doctor|mr|mrs|ms|miss)\.?\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cleaned, capped body text of a page (nav/header/footer/script/style removed). */
function pageText(html: string, cap = 3000): string {
  const c = load(html);
  c("nav, header, footer, script, style, noscript, form, svg").remove();
  return c("body").text().replace(/\s+/g, " ").trim().slice(0, cap);
}

const PROVIDER_SYSTEM = `You extract the PROVIDERS (named staff: doctors, nurses, PAs, injectors, aestheticians, owners) of a medical spa from its team/about page text plus a list of candidate image URLs. Return ONLY real people actually NAMED on the page.

- Extract up to 10 provider/practitioner/staff people NAMED on the site (a clinic may have one or many; the owner may appear alone on an About page). Prefer clinical providers and the owner/medical director.
- name: the person's name only (no trailing credentials in this field).
- title: their role/credentials as shown — PREFER the medical-professional designation (e.g. "DNP, FNP-C", "Aesthetic Injector", "Nurse Practitioner", "CEO, Medical Director, Founder"). null if none shown.
- image_url: their headshot — copy VERBATIM from the PROVIDER IMAGE CANDIDATES list, matched to the person (the filename or alt often contains their name, e.g. SHELBY-HEADSHOT.webp → Shelby). null if no candidate matches this person.
- is_owner: true for the owner / CEO / founder / medical director (the boss). Usually exactly one; false for everyone else.
- card_tagline: a short tagline for the OWNER only (a founder/role one-liner from the site); null for all non-owners.
- Do NOT invent people, and do NOT list services, treatments, locations, or testimonials as providers. If the page names no real people, return an empty array.
Call record_providers exactly once.`;

const PROVIDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["providers"],
  properties: {
    providers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "title", "image_url", "card_tagline", "is_owner"],
        properties: {
          name: { type: "string" },
          title: { type: ["string", "null"] },
          image_url: { type: ["string", "null"] },
          card_tagline: { type: ["string", "null"] },
          is_owner: { type: "boolean" },
        },
      },
    },
  },
} as const;

const stats = { clinics: 0, inserted: 0, updated: 0, skippedNoProvider: 0, fetchFail: 0, aiFail: 0 };

async function extract(c: Clinic): Promise<AiProvider[] | null> {
  const home = await fetchHtml(c.website);
  if (!home) { stats.fetchFail++; return null; }
  const $home = load(home.html);

  // Discover team/about pages; fetch up to 2 (team preferred). Fall back to home.
  let pages: string[] = [];
  try { pages = await discoverContentPages($home, home.finalUrl); } catch { /* ignore */ }
  const teamPages = pages
    .filter((u) => { try { return TEAMISH.test(new URL(u).pathname); } catch { return false; } })
    .sort((a, b) => (/(team|staff|provider|meet|injector|practitioner)/i.test(b) ? 1 : 0) - (/(team|staff|provider|meet|injector|practitioner)/i.test(a) ? 1 : 0))
    .slice(0, 2);

  const texts: string[] = [];
  const candidates = new Map<string, string>(); // url → alt
  const addCands = ($: ReturnType<typeof load>, base: string) => {
    for (const cand of collectImageCandidates($, base)) if (!candidates.has(cand.url)) candidates.set(cand.url, cand.alt);
  };
  addCands($home, home.finalUrl); // homepage headshots (some clinics list staff on home)

  for (const url of teamPages) {
    const pg = await fetchHtml(url);
    if (!pg) continue;
    const $ = load(pg.html);
    texts.push(pageText(pg.html, 2600));
    addCands($, pg.finalUrl);
  }
  if (texts.length === 0) texts.push(pageText(home.html, 3000)); // no team page → use homepage text

  const candList = [...candidates.entries()].slice(0, 60);
  const user =
    `CLINIC: ${c.name}\n\nTEAM / ABOUT PAGE TEXT:\n${texts.join("\n\n---\n\n").slice(0, 6000)}\n\n` +
    `PROVIDER IMAGE CANDIDATES (choose each provider's image_url ONLY from these exact URLs):\n` +
    (candList.length ? candList.map(([u, alt]) => `- ${u}${alt ? ` alt="${alt}"` : ""}`).join("\n") : "(none)");

  try {
    const res = await extractViaOpenAI<{ providers: AiProvider[] }>({
      system: PROVIDER_SYSTEM,
      user,
      toolName: "record_providers",
      toolDescription: "Record the clinic's named providers/staff.",
      inputSchema: PROVIDER_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 1200,
    });
    // Keep only providers with a headshot copied verbatim from our candidate list.
    const candSet = new Set(candidates.keys());
    const seen = new Set<string>();
    let kept = (res.data.providers ?? [])
      .filter((p) => p.name && p.name.trim().length >= 3)
      .filter((p) => p.image_url && candSet.has(p.image_url))
      .filter((p) => { const k = normName(p.name); if (!k || seen.has(k)) return false; seen.add(k); return true; });
    // At most one owner; owner floated first.
    let ownerTaken = false;
    kept = kept.map((p) => {
      const owner = p.is_owner && !ownerTaken;
      if (owner) ownerTaken = true;
      return { ...p, is_owner: owner, card_tagline: owner ? (p.card_tagline || p.title || "Owner") : null };
    });
    kept.sort((a, b) => (b.is_owner ? 1 : 0) - (a.is_owner ? 1 : 0));
    return kept.slice(0, CAP);
  } catch (e) {
    stats.aiFail++;
    console.warn(`  ! OpenAI failed for ${c.name}: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
    return null;
  }
}

async function persist(c: Clinic, providers: AiProvider[]) {
  const existing = await query<ExistingRow>(
    `SELECT id, name, title, image_url, card_tagline FROM providers WHERE clinic_id=$1 AND is_active=true`, [c.id]);
  const byName = new Map(existing.map((r) => [normName(r.name), r]));
  for (const p of providers) {
    const match = byName.get(normName(p.name));
    if (match) {
      const sets: string[] = ["image_url = $2", "updated_at = now()"];
      const params: unknown[] = [match.id, p.image_url];
      let n = 3;
      if ((!match.title || !match.title.trim()) && p.title) { sets.push(`title = $${n}`); params.push(p.title); n++; }
      if (p.is_owner && !match.card_tagline) { sets.push(`card_tagline = $${n}`); params.push(p.card_tagline); n++; }
      if (APPLY) await query(`UPDATE providers SET ${sets.join(", ")} WHERE id = $1`, params);
      stats.updated++;
    } else {
      if (APPLY) await query(
        `INSERT INTO providers (clinic_id, name, title, image_url, card_tagline, is_verified, is_active)
         VALUES ($1,$2,$3,$4,$5,false,true)`,
        [c.id, p.name.trim(), p.title, p.image_url, p.card_tagline]);
      stats.inserted++;
    }
  }
}

async function processClinic(c: Clinic) {
  const providers = await extract(c);
  if (!providers || providers.length === 0) {
    stats.skippedNoProvider++;
    console.log(`  · ${c.name} — no headshot provider found (skip)`);
    return;
  }
  stats.clinics++;
  const owner = providers.find((p) => p.is_owner);
  console.log(`  ✓ ${c.name} (${c.has_any ? "photo-less" : "zero"}) — ${providers.length} provider(s)${owner ? `, owner: ${owner.name}` : ""}`);
  for (const p of providers) console.log(`      - ${p.is_owner ? "★ " : "  "}${p.name}${p.title ? ` — ${p.title}` : ""}  [${p.image_url?.slice(0, 70)}]`);
  await persist(c, providers);
}

async function runPool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { await fn(items[idx]); } catch (e) { console.warn(`  ! error: ${e instanceof Error ? e.message : e}`); }
    }
  }));
}

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error("OPENAI_API_KEY is not set."); process.exit(1); }
  let sql = `
    SELECT c.id, c.name, c.slug, c.website,
      EXISTS(SELECT 1 FROM providers p WHERE p.clinic_id=c.id AND p.is_active=true) AS has_any
    FROM clinics c
    WHERE c.is_active=true AND c.website IS NOT NULL AND length(c.website)>0
      AND NOT EXISTS(SELECT 1 FROM providers p WHERE p.clinic_id=c.id AND p.is_active=true
                       AND p.image_url IS NOT NULL AND length(p.image_url)>0)`;
  const params: unknown[] = [];
  if (clinicArg) { sql += ` AND (c.slug=$1 OR c.id::text=$1)`; params.push(clinicArg); }
  sql += ` ORDER BY c.name`;
  if (limitArg) sql += ` LIMIT ${limitArg}`;
  let clinics = await query<Clinic>(sql, params);
  if (ZERO_ONLY) clinics = clinics.filter((c) => !c.has_any);
  if (PHOTOLESS_ONLY) clinics = clinics.filter((c) => c.has_any);

  console.log(`${APPLY ? "APPLY" : "PREVIEW"} — ${clinics.length} clinic(s) with no visible provider\n`);
  await runPool(clinics, CONCURRENCY, processClinic);

  console.log(`\n──────── summary ────────`);
  console.log(`clinics filled:        ${stats.clinics}`);
  console.log(`providers inserted:    ${stats.inserted}`);
  console.log(`providers updated:     ${stats.updated}`);
  console.log(`skipped (no provider): ${stats.skippedNoProvider}`);
  console.log(`fetch failed:          ${stats.fetchFail}`);
  console.log(`OpenAI failed:         ${stats.aiFail}`);
  if (!APPLY) console.log(`\n(preview only — re-run with --apply to write)`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
