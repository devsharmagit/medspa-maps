/**
 * ingest/ingest-concerns.ts — refresh ONLY a clinic's evidence-based concerns.
 *
 * Touches nothing but the concern layer of an EXISTING clinic (keyed by website
 * domain): clinic_concerns rows with source='scraped' + their evidence rows in
 * clinic_concern_evidence. Locations / images / providers / services are never
 * modified. Idempotent replace: prior scraped state is deleted and re-asserted.
 *
 * Flow: resolve clinic → fetch homepage → discoverConcernPages (condition pages
 * + per-treatment pages, nav hrefs included) → one text-only forced-tool AI call
 * (extractClinicConcerns) → machine-verify every evidence quote against the
 * supplied page text (validateConcerns) → canonicalize general names onto the
 * AI-grown concerns catalog (find-or-create origin='ai', services pattern) →
 * persist. Admin overrides survive: 'manual' rows untouched, 'removed' rows are
 * never flipped back by the ingest.
 */

import { query, queryOne } from "@/lib/db";
import { fetchHtml, load, normalizeUrl, slugify } from "@/lib/scraper/utils";
import { extractServiceAnchors, extractServicesFromNav } from "@/lib/scraper/services";
import { normalize, bestCatalogMatch, type CatalogEntry } from "@/lib/taxonomy/canonical";
import { findClinicsByDomain, websiteDomain } from "@/lib/admin/clinic-save";
import { htmlToText } from "@/lib/ingest/ingest-clinic";
import { discoverConcernPages } from "@/lib/ingest/discover";
import { extractClinicConcerns, condenseForConcerns } from "@/lib/ingest/ai-extract-concerns";
import {
  validateConcerns,
  type ClinicServiceRef,
  type ConcernRejection,
  type ValidatedConcern,
} from "@/lib/ingest/concern-validate";
import type { ExtractedConcern } from "@/lib/ingest/ai-extract-concerns";

export interface ConcernIngestResult {
  domain: string;
  status: "saved" | "skipped" | "failed";
  clinicId?: string;
  slug?: string;
  pagesFetched: number;
  /** concerns asserted (each with ≥1 verified evidence quote) */
  concerns: ValidatedConcern[];
  /** AI items discarded by verification, with reasons */
  rejected: ConcernRejection[];
  /** new origin='ai' concern catalog rows created this run */
  createdConcerns: string[];
  modelUsed: string;
  usage: { input_tokens: number; output_tokens: number };
  note?: string;
}

interface ConcernCatRow extends CatalogEntry {
  id: string;
  origin: string;
  aliases: string[];
}

const TREATMENT_AREA_TERMS = [
  "Forehead Lines",
  "Scowl Lines (11s)",
  "Bunny Lines",
  "Brow Lift",
  "Crow's Feet",
  "Crow’s Feet",
  "Lip Flip",
  "Dimpled Chin",
  "Platysma (Vertical Neck Cords)",
  "Hyperhidrosis (Excessive Sweating)",
  "Masseter (TMJ) / Face Slimming",
  "Headache / Migraine Relief",
];

const NEUROTOXIN_PAGE_RE =
  /\b(botox|dysport|xeomin|daxxify|jeuveau|tox|neurotoxin|injectables?)\b/i;
const TREATMENT_AREA_INTENT_RE =
  /\b(smooth|soften|reduce|lessen|eliminate|diminish|elevate|improve|relax|control|treat|address|refine|restore|enhance|slim|contour|even out)\b/i;

function serviceNameForPage(url: string, services: ClinicServiceRef[]): string[] {
  const key = (u: string) => u.trim().replace(/\/+$/, "").toLowerCase();
  const match = services.find((s) => s.scraped_from_url && key(s.scraped_from_url) === key(url));
  return match ? [match.canonical_name || match.raw_name] : [];
}

function quoteForTreatmentArea(text: string, term: string): string | null {
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const idx = lowerText.indexOf(lowerTerm, searchFrom);
    if (idx < 0) return null;
    const after = text.slice(idx);
    let end = after.length;
    for (const next of TREATMENT_AREA_TERMS) {
      if (next.toLowerCase() === lowerTerm) continue;
      const nextIdx = after.toLowerCase().indexOf(next.toLowerCase(), term.length);
      if (nextIdx > term.length && nextIdx < end) end = nextIdx;
    }
    const quote = after.slice(0, end).replace(/\s+/g, " ").trim();
    const local = text.slice(Math.max(0, idx - 500), Math.min(text.length, idx + quote.length + 500));
    if (
      quote.length > term.length + 8 &&
      (TREATMENT_AREA_INTENT_RE.test(quote) || /\btreatment areas?\b/i.test(local))
    ) {
      return quote.slice(0, 260);
    }
    searchFrom = idx + term.length;
  }
  return null;
}

function extractTreatmentAreaConcerns(
  pages: Array<{ url: string; text: string }>,
  services: ClinicServiceRef[]
): ExtractedConcern[] {
  const out: ExtractedConcern[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const treatmentNames = serviceNameForPage(page.url, services);
    if (treatmentNames.length === 0) continue;
    if (!NEUROTOXIN_PAGE_RE.test(`${page.url} ${treatmentNames.join(" ")} ${page.text.slice(0, 500)}`)) {
      continue;
    }
    for (const term of TREATMENT_AREA_TERMS) {
      const quote = quoteForTreatmentArea(page.text, term);
      if (!quote) continue;
      const cleanTerm = term.replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
      const key = `${page.url}|${cleanTerm.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        raw_phrase: cleanTerm,
        general_name: cleanTerm,
        paired_treatments: treatmentNames,
        source_url: page.url,
        evidence_quote: quote,
      });
    }
  }
  return out;
}

/** Title-case a single word, preserving acronyms (TMJ, RF, IV) and tokens with
 *  digits ("11s", "B12"). Never uppercases the letter after an apostrophe — the
 *  old `\b[a-z]` rule turned "crow's feet" into "Crow'S Feet". */
function titleCaseWord(w: string): string {
  if (!w) return w;
  if (/\d/.test(w)) return w;
  const letters = w.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 2 && letters.length <= 4 && letters === letters.toUpperCase()) return w;
  const i = w.search(/[a-zA-Z]/);
  if (i < 0) return w;
  return w.slice(0, i) + w[i].toUpperCase() + w.slice(i + 1).toLowerCase();
}

function displayConcernName(name: string): string {
  const clean = name.replace(/[®™©]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return clean;
  return clean.split(" ").map(titleCaseWord).join(" ");
}

/** Load the live concern catalog (curated seeds + AI-grown). */
async function loadConcernCatalog(): Promise<ConcernCatRow[]> {
  const rows = await query<{
    id: string;
    name: string;
    slug: string;
    aliases: string[] | null;
    origin: string | null;
  }>(
    `SELECT id, name, slug, COALESCE(aliases, '{}') AS aliases, COALESCE(origin, 'seed') AS origin
       FROM concerns WHERE is_active = true`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    aliases: r.aliases ?? [],
    origin: r.origin ?? "seed",
  }));
}

export async function ingestConcernsByDomain(
  rawDomain: string
): Promise<ConcernIngestResult> {
  const domain = websiteDomain(rawDomain);
  const base: ConcernIngestResult = {
    domain,
    status: "failed",
    pagesFetched: 0,
    concerns: [],
    rejected: [],
    createdConcerns: [],
    modelUsed: "",
    usage: { input_tokens: 0, output_tokens: 0 },
  };

  // 1) resolve the EXISTING clinic (never create one here)
  const clinicIds = await findClinicsByDomain(domain);
  if (clinicIds.length === 0) {
    return { ...base, status: "skipped", note: "no clinic for this domain" };
  }
  const clinicId = clinicIds[0];
  const clinicRow = await queryOne<{ slug: string; website: string | null }>(
    `SELECT slug, website FROM clinics WHERE id = $1`,
    [clinicId]
  );
  const slug = clinicRow?.slug;

  // 2) fetch homepage + concern-targeted pages
  const startUrl = normalizeUrl(clinicRow?.website || rawDomain);
  const home = await fetchHtml(startUrl);
  if (!home) {
    return { ...base, clinicId, slug, status: "skipped", note: "homepage unreachable" };
  }
  const $home = load(home.html);
  const finalUrl = home.finalUrl || startUrl;

  const navServiceUrls = [
    ...extractServicesFromNav($home, finalUrl),
    ...extractServiceAnchors($home, finalUrl),
  ]
    .map((s) => s.scraped_from_url)
    .filter((u): u is string => !!u);
  const { concernPages, servicePages } = await discoverConcernPages(
    $home,
    finalUrl,
    navServiceUrls,
    { servicePages: Math.min(45, Math.max(12, navServiceUrls.length)) }
  );

  // Condense each page to its condition-relevant sentences (see
  // condenseForConcerns) — the SAME text feeds the AI and the validator.
  const pages: Array<{ url: string; text: string }> = [
    { url: finalUrl, text: condenseForConcerns(htmlToText($home)) },
  ];
  for (const u of [...concernPages, ...servicePages]) {
    const r = await fetchHtml(u);
    if (!r) continue;
    pages.push({ url: u, text: condenseForConcerns(htmlToText(load(r.html))) });
  }
  base.pagesFetched = pages.length;

  // 3) clinic services (for paired-treatment resolution) + live concern catalog
  const clinicServices = await query<ClinicServiceRef>(
    `SELECT cs.service_id, cs.raw_name, s.name AS canonical_name, cs.scraped_from_url
       FROM clinic_services cs
       LEFT JOIN services s ON s.id = cs.service_id
      WHERE cs.clinic_id = $1 AND cs.is_active = true
        AND s.id IS NOT NULL
        AND s.is_active = true
        AND COALESCE(s.is_published, true) = true
        AND COALESCE(s.review_status, 'approved') = 'approved'
        AND s.name !~* '(dentistry|dental|orthodont|veneer)'`,
    [clinicId]
  );
  const catalog = await loadConcernCatalog();

  // 4) AI extraction + machine verification of every quote. Pages are sent in
  //    BATCHES: a single call with 10+ pages (~150K+ chars) reliably trips
  //    Gemini flash into MALFORMED_FUNCTION_CALL, so bound each call and merge.
  //    Validation still runs against the FULL page set.
  // Pack condensed pages into as FEW calls as possible (fewest requests is the
  // goal — the free tier's binding limit is requests/day). Batch by total size,
  // not a fixed page count: with condensed pages a whole clinic usually fits in
  // ONE call. The self-healing split keeps a rare oversized/dense batch from
  // failing the clinic (MALFORMED after gemini.ts's own retries → split + retry).
  const BATCH_CHAR_BUDGET = 45_000;
  const knownConcerns = catalog.map((c) => c.name);
  const knownTreatments = [
    ...new Set(
      clinicServices.map((s) => s.canonical_name ?? s.raw_name).filter(Boolean)
    ),
  ] as string[];
  const batches: Array<typeof pages> = [];
  let cur: typeof pages = [];
  let curLen = 0;
  for (const p of pages) {
    if (cur.length && curLen + p.text.length > BATCH_CHAR_BUDGET) {
      batches.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(p);
    curLen += p.text.length;
  }
  if (cur.length) batches.push(cur);

  const extracted: Awaited<ReturnType<typeof extractClinicConcerns>>["concerns"] = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let model = "";
  const runBatch = async (batch: typeof pages): Promise<void> => {
    try {
      const out = await extractClinicConcerns({ domain, pages: batch, knownConcerns, knownTreatments });
      extracted.push(...out.concerns);
      model = out.model;
      usage.input_tokens += out.usage?.input_tokens ?? 0;
      usage.output_tokens += out.usage?.output_tokens ?? 0;
    } catch (err) {
      // Never split for a per-day 429 (splitting just burns more of the daily
      // budget) — only for a MALFORMED/oversized batch that can be salvaged.
      if (batch.length <= 1 || /Gemini 429/.test((err as Error).message)) throw err;
      const mid = Math.ceil(batch.length / 2);
      await runBatch(batch.slice(0, mid));
      await runBatch(batch.slice(mid));
    }
  };
  for (const batch of batches) await runBatch(batch);
  extracted.push(...extractTreatmentAreaConcerns(pages, clinicServices));
  const { accepted, rejected } = validateConcerns(
    extracted,
    pages,
    clinicServices,
    catalog.flatMap((c) => [c.name, ...c.aliases])
  );

  // 5) canonicalize onto the AI-grown catalog (find-or-create, services pattern)
  const uniqueConcernSlug = async (nameBase: string): Promise<string> => {
    const root = slugify(nameBase) || "concern";
    let s = root;
    let n = 2;
    while (
      catalog.some((c) => c.slug === s) ||
      (await queryOne(`SELECT 1 FROM concerns WHERE slug = $1`, [s]))
    ) {
      s = `${root}-${n++}`;
    }
    return s;
  };
  const addAiAlias = async (row: ConcernCatRow, rawPhrase: string) => {
    if (row.origin !== "ai") return; // never mutate curated/seed rows
    const a = normalize(rawPhrase);
    if (!a || a === normalize(row.name) || row.aliases.includes(a)) return;
    row.aliases.push(a);
    await query(
      `UPDATE concerns SET aliases = array_append(COALESCE(aliases,'{}'), $2), updated_at = NOW()
         WHERE id = $1 AND NOT ($2 = ANY(COALESCE(aliases,'{}')))`,
      [row.id, a]
    );
  };
  const createdConcerns: string[] = [];
  const exactConcernRow = (name: string): ConcernCatRow | null => {
    const n = normalize(name);
    if (!n) return null;
    return (
      catalog.find(
        (c) =>
          normalize(c.name) === n ||
          normalize(c.slug) === n ||
          c.aliases.some((a) => normalize(a) === n)
      ) ?? null
    );
  };
  // Resolve a general name to a catalog row, merging ONLY exact synonyms so
  // specific concerns stay distinct (Forehead Lines ≠ Crow's Feet):
  //   1. exact normalized name / slug / alias
  //   2. fuzzy Dice ≥ 0.82   → "Fine Lines and Wrinkles" ⇒ "Wrinkles & Fine Lines"
  //   3. token-prefix        → "Crow's Feet Around the Eyes" ⇒ "Crow's Feet"
  //   4. otherwise create a new AI concern row
  const cTokens = (s: string) => normalize(s).split(" ").filter(Boolean);
  const isTokenPrefix = (short: string[], long: string[]) =>
    short.length >= 2 && short.length < long.length && short.every((t, i) => t === long[i]);
  const resolveConcernRow = async (name: string): Promise<ConcernCatRow> => {
    const exact = exactConcernRow(name);
    if (exact) return exact;
    const fuzzy = bestCatalogMatch(name, catalog, 0.82);
    if (fuzzy) return catalog.find((c) => c.slug === fuzzy.entry.slug)!;
    const gt = cTokens(name);
    const contained = catalog.find(
      (c) => isTokenPrefix(cTokens(c.name), gt) || isTokenPrefix(gt, cTokens(c.name))
    );
    if (contained) return contained;
    return createAiConcern(name);
  };
  const createAiConcern = async (name: string): Promise<ConcernCatRow> => {
    const clean = displayConcernName(name);
    const s = await uniqueConcernSlug(clean);
    const aliases = [...new Set([normalize(clean)].filter(Boolean))];
    // is_published=false: AI-grown concerns have no editorial copy, so they stay
    // off the /conditions index until curated; clinic chips still use them.
    const ins = await queryOne<{ id: string }>(
      `INSERT INTO concerns (name, slug, aliases, data_source, origin, is_published, is_active)
       VALUES ($1,$2,$3,'scraped','ai',false,true)
       ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [clean, s, aliases]
    );
    const row: ConcernCatRow = { id: ins!.id, name: clean, slug: s, aliases, origin: "ai" };
    catalog.push(row);
    createdConcerns.push(clean);
    return row;
  };

  const resolved: Array<{ row: ConcernCatRow; concern: ValidatedConcern }> = [];
  for (const concern of accepted) {
    const row = await resolveConcernRow(concern.general_name);
    for (const ev of concern.evidences) await addAiAlias(row, ev.raw_phrase);
    // Two general names can land on the same catalog row — merge their evidence.
    const existing = resolved.find((r) => r.row.id === row.id);
    if (existing) existing.concern.evidences.push(...concern.evidences);
    else resolved.push({ row, concern });
  }

  // 6) persist — replace this clinic's scraped concern state ONLY.
  //    'manual' rows are left alone; 'removed' rows are admin suppressions and
  //    are never flipped back by the ingest (evidence rows still recorded).
  await query(`DELETE FROM clinic_concern_evidence WHERE clinic_id = $1`, [clinicId]);
  await query(
    `DELETE FROM clinic_concerns WHERE clinic_id = $1 AND source = 'scraped'`,
    [clinicId]
  );
  for (const { row, concern } of resolved) {
    await query(
      `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active)
       VALUES ($1, $2, 'scraped', true)
       ON CONFLICT (clinic_id, concern_id) DO UPDATE SET
         source = 'scraped',
         is_active = true,
         updated_at = NOW()
       WHERE clinic_concerns.source <> 'removed'`,
      [clinicId, row.id]
    );
    for (const ev of concern.evidences) {
      await query(
        `INSERT INTO clinic_concern_evidence
           (clinic_id, concern_id, raw_phrase, evidence_quote, source_url,
            paired_treatments, paired_service_ids)
         VALUES ($1,$2,$3,$4,$5,$6,$7::uuid[])
         ON CONFLICT (clinic_id, concern_id, source_url, raw_phrase) DO UPDATE SET
           evidence_quote = EXCLUDED.evidence_quote,
           paired_treatments = EXCLUDED.paired_treatments,
           paired_service_ids = EXCLUDED.paired_service_ids,
           extracted_at = NOW()`,
        [
          clinicId,
          row.id,
          ev.raw_phrase,
          ev.evidence_quote,
          ev.source_url,
          ev.paired_treatments,
          ev.paired_service_ids,
        ]
      );
    }
  }

  return {
    ...base,
    status: "saved",
    clinicId,
    slug,
    concerns: resolved.map((r) => ({
      ...r.concern,
      general_name: r.row.name, // report the catalog name it resolved to
    })),
    rejected,
    createdConcerns,
    modelUsed: model,
    usage,
  };
}
