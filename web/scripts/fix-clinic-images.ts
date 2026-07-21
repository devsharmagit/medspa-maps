// @ts-nocheck

/**
 * scripts/fix-clinic-images.ts — one-off DATA FIX: backfill missing clinic
 * LOGOS and COVER/hero images by scraping each clinic site's HTML. No AI, no
 * tokens — reuses the same heuristic extractors the pipeline uses
 * (extractLogo / extractCover in src/lib/scraper/images.ts) plus a small
 * apple-touch-icon / og:logo fallback for logos.
 *
 * Writes ONLY new rows into `images` (role 'logo' / 'cover', scrape_status
 * 'ok', source_url only — the detail page reads source_url directly). Never
 * deletes or overwrites; ON CONFLICT (entity_type, entity_id, source_url) DO
 * NOTHING. Only targets clinics that are MISSING a logo / hero image.
 *
 *   bun scripts/fix-clinic-images.ts                    # preview ALL (no writes)
 *   bun scripts/fix-clinic-images.ts --clinic=<slug|id> # one clinic
 *   bun scripts/fix-clinic-images.ts --limit=20         # first N
 *   bun scripts/fix-clinic-images.ts --logos-only       # skip covers
 *   bun scripts/fix-clinic-images.ts --covers-only      # skip logos
 *   bun scripts/fix-clinic-images.ts --apply            # write
 */
import "dotenv/config";
import pool, { query } from "../src/lib/db";
import { fetchHtml, load, toAbsolute } from "../src/lib/scraper/utils";
import { extractLogo, extractCover } from "../src/lib/scraper/images";

const APPLY = process.argv.includes("--apply");
const LOGOS_ONLY = process.argv.includes("--logos-only");
const COVERS_ONLY = process.argv.includes("--covers-only");
const clinicArg = process.argv.find((a) => a.startsWith("--clinic="))?.split("=")[1];
const limitArg = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 0;
const CONCURRENCY = 6;

interface Clinic {
  id: string; name: string; slug: string; website: string | null;
  has_logo: boolean; has_hero: boolean; city: string | null;
}

const domainOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } };
const badSrc = (s?: string | null) => !s || /^data:/i.test(s) || !/^https?:/i.test(s);
// A "logo" whose URL screams hero/background is a false positive (the header-img
// selector sometimes grabs the hero) — reject so we fall back to the favicon.
const looksLikeBackground = (s: string) => /background|hero|banner|slider|masthead|homepage|cover|\bbg[-_]/i.test(s);

/** Logo fallback the shared extractLogo doesn't cover: apple-touch-icon / og:logo. */
function logoFallback($: ReturnType<typeof load>, base: string): string | null {
  const og = $("meta[property='og:logo']").attr("content");
  if (og) { const a = toAbsolute(og, base); if (a) return a; }
  // Prefer the apple-touch-icon (usually 180px, clean square PNG).
  let best: { url: string; size: number } | null = null;
  $("link[rel~='apple-touch-icon'], link[rel='apple-touch-icon-precomposed']").each((_, el) => {
    const href = $(el).attr("href"); if (!href) return;
    const abs = toAbsolute(href, base); if (!abs) return;
    const size = parseInt(($(el).attr("sizes") ?? "").split("x")[0] || "180", 10) || 180;
    if (!best || size > best.size) best = { url: abs, size };
  });
  if (best) return best!.url;
  // Last resort: a reasonably-sized <link rel=icon> (skip tiny 16/32 favicons).
  $("link[rel='icon'], link[rel='shortcut icon']").each((_, el) => {
    if (best) return;
    const href = $(el).attr("href"); if (!href) return;
    const size = parseInt(($(el).attr("sizes") ?? "").split("x")[0] || "0", 10);
    if (size >= 96) { const abs = toAbsolute(href, base); if (abs) best = { url: abs, size }; }
  });
  return best ? best!.url : null;
}

interface Planned { role: "logo" | "cover"; source_url: string; alt_text: string | null; }
const stats = { logos: 0, covers: 0, noLogo: 0, noCover: 0, fetchFail: 0 };

async function processClinic(c: Clinic): Promise<void> {
  const needLogo = !c.has_logo && !COVERS_ONLY;
  const needCover = !c.has_hero && !LOGOS_ONLY;
  if (!needLogo && !needCover) return;
  if (!c.website) return;

  const r = await fetchHtml(c.website);
  if (!r) { stats.fetchFail++; console.log(`  ✗ ${c.name} — fetch failed (${c.website})`); return; }
  const $ = load(r.html);
  const base = r.finalUrl;
  const domain = domainOf(c.website);

  const planned: Planned[] = [];

  // Resolve the logo URL regardless (used to insert AND to exclude it from cover
  // candidates so a logo never gets picked as the hero image).
  const logo = extractLogo($, base);
  const logoGood = logo && !badSrc(logo.source_url) && !looksLikeBackground(logo.source_url);
  const logoSrc = logoGood ? logo!.source_url : logoFallback($, base);

  if (needLogo) {
    if (logoSrc && !badSrc(logoSrc)) planned.push({ role: "logo", source_url: logoSrc, alt_text: (logoGood ? logo!.alt_text : null) ?? null });
    else stats.noLogo++;
  }
  if (needCover) {
    const cover = extractCover($, base, c.name, c.city ?? undefined, logoSrc);
    if (cover && !badSrc(cover.source_url) && cover.source_url !== logoSrc) planned.push({ role: "cover", source_url: cover.source_url, alt_text: cover.alt_text ?? null });
    else stats.noCover++;
  }

  if (planned.length === 0) {
    if (needLogo || needCover) console.log(`  · ${c.name} — nothing extractable`);
    return;
  }

  for (const p of planned) {
    p.role === "logo" ? stats.logos++ : stats.covers++;
    console.log(`  ✓ ${c.name} [${p.role}] ${p.source_url.slice(0, 90)}`);
    if (APPLY) {
      await query(
        `INSERT INTO images (entity_type, entity_id, source_url, role, sort_order, alt_text, scraped_domain, scrape_status)
         VALUES ('clinic', $1, $2, $3, 0, $4, $5, 'ok')
         ON CONFLICT (entity_type, entity_id, source_url) DO NOTHING`,
        [c.id, p.source_url, p.role, p.alt_text, domain]
      );
    }
  }
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
  let sql = `
    SELECT c.id, c.name, c.slug, c.website,
      EXISTS(SELECT 1 FROM images i WHERE i.entity_type='clinic' AND i.entity_id=c.id AND i.role='logo' AND i.scrape_status='ok') AS has_logo,
      EXISTS(SELECT 1 FROM images i WHERE i.entity_type='clinic' AND i.entity_id=c.id AND i.role IN ('cover','gallery') AND i.scrape_status='ok') AS has_hero,
      (SELECT city FROM clinic_locations cl WHERE cl.clinic_id=c.id AND cl.is_active=true ORDER BY is_primary DESC, sort_order LIMIT 1) AS city
    FROM clinics c
    WHERE c.is_active=true AND c.website IS NOT NULL AND length(c.website)>0`;
  const params: unknown[] = [];
  if (clinicArg) { sql += ` AND (c.slug = $1 OR c.id::text = $1)`; params.push(clinicArg); }
  sql += ` ORDER BY c.name`;
  if (limitArg) sql += ` LIMIT ${limitArg}`;
  const clinics = await query<Clinic>(sql, params);

  const targets = clinics.filter((c) => (!c.has_logo && !COVERS_ONLY) || (!c.has_hero && !LOGOS_ONLY));
  console.log(`${APPLY ? "APPLY" : "PREVIEW"} — ${targets.length} clinic(s) missing ${LOGOS_ONLY ? "logo" : COVERS_ONLY ? "cover" : "logo and/or cover"} (of ${clinics.length} scanned)\n`);
  await runPool(targets, CONCURRENCY, processClinic);

  console.log(`\n──────── summary ────────`);
  console.log(`logos found:    ${stats.logos}`);
  console.log(`covers found:   ${stats.covers}`);
  console.log(`no logo found:  ${stats.noLogo}`);
  console.log(`no cover found: ${stats.noCover}`);
  console.log(`fetch failed:   ${stats.fetchFail}`);
  if (!APPLY) console.log(`\n(preview only — re-run with --apply to write)`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
