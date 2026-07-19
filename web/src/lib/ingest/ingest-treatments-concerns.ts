/**
 * Unified refresh for a clinic's treatments AND concerns.
 *
 * This is the brute-force path: collect website content, show the AI the live
 * treatment/concern catalogs at the same time, let it return treatments plus
 * clinic-specific treatment->concern mappings, then replace the scraped state.
 */

import { query, queryOne, withTransaction } from "@/lib/db";
import { fetchHtml, load, normalizeUrl, slugify } from "@/lib/scraper/utils";
import {
  extractServiceAnchors,
  extractServices,
  extractServicesFromNav,
} from "@/lib/scraper/services";
import type { ScrapedService } from "@/lib/scraper/types";
import { bestCatalogMatch, isServiceNoise, isConcernNoise, normalize, type CatalogEntry } from "@/lib/taxonomy/canonical";
import {
  findClinicsByDomain,
  saveClinicServices,
  websiteDomain,
  type SaveService,
} from "@/lib/admin/clinic-save";
import { htmlToText } from "@/lib/ingest/ingest-clinic";
import { discoverConcernPages, discoverContentPages } from "@/lib/ingest/discover";
import { normalizeServiceOutput } from "@/lib/ingest/ingest-services";
import { refineClinicServices } from "@/lib/ingest/ai-extract-services";
import { extractClinicTreatmentsConcerns } from "@/lib/ingest/ai-extract-treatments-concerns";
import type {
  ExtractedStandaloneConcern,
  ExtractedTreatment,
} from "@/lib/ingest/ai-extract-treatments-concerns";

/** A concern the clinic treats, detected deterministically (not via the LLM). */
interface DetectedConcern { name: string; source_url: string | null }

const SERVICES_URL_RE = /\/(services?|treatments?|menu|procedures|what-we-offer)/i;
const SVC_CAND_CAP = 80;
const PAGE_CAP = 48;
const FETCH_URL_CAP = 55;
const FETCH_CONCURRENCY = 4;
const BATCH_CHAR_BUDGET = 70_000;
const PAGE_TEXT_CHAR_LIMIT = 6_000;

function tcLog(domain: string, stage: string, data?: Record<string, unknown>): void {
  console.info(`[treatments-concerns] ${domain} ${stage}`, {
    at: new Date().toISOString(),
    ...(data ?? {}),
  });
}

interface ConcernCatRow extends CatalogEntry {
  id: string;
  origin: string;
  aliases: string[];
}

export interface PersistedTreatmentConcern {
  service_id: string;
  service_name: string;
  concern_id: string;
  concern_name: string;
  raw_service_name: string | null;
  raw_concern_name: string;
  source_url: string | null;
}

export interface TreatmentsConcernsResult {
  domain: string;
  status: "saved" | "skipped" | "failed";
  clinicId?: string;
  slug?: string;
  pagesFetched: number;
  treatmentsFound: number;
  servicesMatched: number;
  servicesAuto: number;
  servicesUnmatched: number;
  concernsFound: number;
  concernsSaved: number;
  mappingsFound: number;
  mappingsSaved: number;
  createdConcerns: string[];
  associations: PersistedTreatmentConcern[];
  modelUsed: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
  note?: string;
}

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
  return clean.split(" ").map(titleCaseWord).join(" ");
}

async function loadConcernCatalog(): Promise<ConcernCatRow[]> {
  const rows = await query<{
    id: string;
    name: string;
    slug: string;
    origin: string | null;
  }>(
    `SELECT id, name, slug, COALESCE(origin, 'seed') AS origin
       FROM concerns WHERE is_active = true`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    aliases: [],
    origin: r.origin ?? "seed",
  }));
}

/** Coarse content fingerprint to catch near-duplicate templated pages (e.g.
 *  per-city SEO clones) that share the same body — dedup by URL alone misses them. */
function contentKey(text: string): string {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (t.length < 200) return `s:${t}`; // short pages: exact
  return `${t.length}:${t.slice(0, 160)}:${t.slice(-160)}`;
}

function pushPage(
  pages: Array<{ url: string; text: string }>,
  seen: Set<string>,
  url: string,
  text: string,
  seenContent?: Set<string>
): void {
  const key = url.replace(/\/+$/, "").toLowerCase();
  if (seen.has(key) || pages.length >= PAGE_CAP) return;
  if (seenContent) {
    const ck = contentKey(text);
    if (ck && seenContent.has(ck)) { seen.add(key); return; } // near-dup body — skip
    if (ck) seenContent.add(ck);
  }
  seen.add(key);
  pages.push({ url, text });
}

function dedupeUrls(urls: string[], cap: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const key = url.replace(/\/+$/, "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(url);
    if (out.length >= cap) break;
  }
  return out;
}

const pageUrlKey = (u: string): string => u.replace(/\/+$/, "").toLowerCase();

async function collectPagesAndCandidates(
  rawDomain: string,
  clinicWebsite: string | null
): Promise<{
  finalUrl: string;
  pages: Array<{ url: string; text: string }>;
  serviceCandidates: Array<{ name: string; category?: string | null; url?: string | null }>;
  /** true when the site has a dedicated conditions/concerns section. */
  hasConditionsSection: boolean;
  /** urlKeys of condition/hub pages (+ homepage) — the trusted concern source. */
  concernPageKeys: Set<string>;
  /** crawl health: how many extra pages we tried vs. actually fetched. */
  pagesRequested: number;
  pagesFetchedOk: number;
}> {
  const startUrl = normalizeUrl(clinicWebsite || rawDomain);
  const domain = websiteDomain(rawDomain);
  const started = Date.now();
  tcLog(domain, "collect-start", { startUrl });
  const home = await fetchHtml(startUrl);
  if (!home) throw new Error("homepage unreachable");
  const $home = load(home.html);
  const finalUrl = home.finalUrl || startUrl;

  const pages: Array<{ url: string; text: string }> = [];
  const seenPages = new Set<string>();
  const seenContent = new Set<string>();
  // Treatments/concerns pass: strip nav/header/footer chrome (pure boilerplate
  // repeated on every page) so the model sees the real service/condition copy.
  pushPage(pages, seenPages, finalUrl, htmlToText($home, { stripChrome: true }), seenContent);

  const serviceCandidates: Array<{ name: string; category?: string | null; url?: string | null }> = [];
  const seenSvc = new Set<string>();
  const addSvcCands = (list: ScrapedService[]) => {
    for (const c of list) {
      const key = c.name?.trim().toLowerCase();
      if (!key || seenSvc.has(key) || serviceCandidates.length >= SVC_CAND_CAP) continue;
      seenSvc.add(key);
      serviceCandidates.push({
        name: c.name.trim(),
        category: c.category ?? null,
        url: c.scraped_from_url ?? null,
      });
    }
  };

  addSvcCands(extractServicesFromNav($home, finalUrl));
  addSvcCands(extractServiceAnchors($home, finalUrl));
  tcLog(domain, "home-collected", {
    finalUrl,
    serviceCandidates: serviceCandidates.length,
    ms: Date.now() - started,
  });

  const navServiceUrls = serviceCandidates
    .map((s) => s.url)
    .filter((u): u is string => !!u);
  const [contentPages, concernDiscovery] = await Promise.all([
    discoverContentPages($home, finalUrl),
    discoverConcernPages($home, finalUrl, navServiceUrls, {
      concernPages: 8,
      servicePages: Math.min(32, Math.max(16, navServiceUrls.length)),
    }),
  ]);
  tcLog(domain, "discovery-done", {
    navServiceUrls: navServiceUrls.length,
    contentPages: contentPages.length,
    discoveredServicePages: concernDiscovery.servicePages.length,
    discoveredConcernPages: concernDiscovery.concernPages.length,
    ms: Date.now() - started,
  });

  const neurotoxinUrls = navServiceUrls.filter((u) => NEUROTOXIN_PAGE_RE.test(u));
  // Concern/condition pages FIRST so they're never crowded out of the fetch
  // budget by a large service-page set — critical for conditions-led sites where
  // those pages ARE the concern source.
  const urls = dedupeUrls([
    ...concernDiscovery.concernPages,
    ...neurotoxinUrls,
    ...navServiceUrls,
    ...concernDiscovery.servicePages,
    ...contentPages,
  ], FETCH_URL_CAP);
  // Trusted concern-source pages for conditions-led sites: homepage + condition pages.
  const concernPageKeys = new Set<string>([pageUrlKey(finalUrl)]);
  for (const u of concernDiscovery.concernPages) concernPageKeys.add(pageUrlKey(u));
  tcLog(domain, "fetch-plan", {
    candidateUrls:
      neurotoxinUrls.length +
      navServiceUrls.length +
      concernDiscovery.servicePages.length +
      concernDiscovery.concernPages.length +
      contentPages.length,
    selectedUrls: urls.length,
    pageCap: PAGE_CAP,
    fetchUrlCap: FETCH_URL_CAP,
    concurrency: FETCH_CONCURRENCY,
    ms: Date.now() - started,
  });
  let attempted = 0;
  let fetched = 0;
  for (let i = 0; i < urls.length && pages.length < PAGE_CAP; i += FETCH_CONCURRENCY) {
    const chunk = urls.slice(i, i + FETCH_CONCURRENCY);
    attempted += chunk.length;
    const results = await Promise.all(
      chunk.map(async (u) => {
        const r = await fetchHtml(u);
        return { u, r };
      })
    );
    for (const { u, r } of results) {
      if (pages.length >= PAGE_CAP) break;
      if (!r) continue;
      fetched++;
      const $p = load(r.html);
      const finalKey = pageUrlKey(r.finalUrl || u);
      // Keep concernPageKeys aligned to the page's FINAL (post-redirect) url.
      if (concernPageKeys.has(pageUrlKey(u))) concernPageKeys.add(finalKey);
      pushPage(pages, seenPages, r.finalUrl || u, htmlToText($p, { stripChrome: true }), seenContent);
      addSvcCands(extractServicesFromNav($p, u));
      addSvcCands(extractServiceAnchors($p, u));
      if (SERVICES_URL_RE.test(u)) addSvcCands(extractServices($p, u));
    }
    if (attempted % 12 === 0 || attempted >= urls.length || pages.length >= PAGE_CAP) {
      tcLog(domain, "fetch-progress", {
        attempted,
        fetched,
        pages: pages.length,
        serviceCandidates: serviceCandidates.length,
        ms: Date.now() - started,
      });
    }
  }
  tcLog(domain, "collect-done", {
    attempted,
    fetched,
    pages: pages.length,
    serviceCandidates: serviceCandidates.length,
    hasConditionsSection: concernDiscovery.hasConditionsSection,
    ms: Date.now() - started,
  });

  return {
    finalUrl,
    pages,
    serviceCandidates,
    hasConditionsSection: concernDiscovery.hasConditionsSection,
    concernPageKeys,
    pagesRequested: attempted,
    pagesFetchedOk: fetched,
  };
}

function pageBatches(pages: Array<{ url: string; text: string }>): Array<Array<{ url: string; text: string }>> {
  const batches: Array<Array<{ url: string; text: string }>> = [];
  let cur: Array<{ url: string; text: string }> = [];
  let curLen = 0;

  for (const page of pages) {
    const pageLen = Math.min(page.text.length, PAGE_TEXT_CHAR_LIMIT);
    if (cur.length && curLen + pageLen > BATCH_CHAR_BUDGET) {
      batches.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(page);
    curLen += pageLen;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

async function resolveConcernRow(
  catalog: ConcernCatRow[],
  createdConcerns: string[],
  name: string
): Promise<ConcernCatRow> {
  const n = normalize(name);
  const exact = catalog.find(
    (c) => normalize(c.name) === n || normalize(c.slug) === n || c.aliases.some((a) => normalize(a) === n)
  );
  if (exact) return exact;
  const fuzzy = bestCatalogMatch(name, catalog, 0.84);
  if (fuzzy) return catalog.find((c) => c.slug === fuzzy.entry.slug)!;

  const clean = displayConcernName(name);
  const root = slugify(clean) || "concern";
  let slug = root;
  let i = 2;
  while (
    catalog.some((c) => c.slug === slug) ||
    (await queryOne(`SELECT 1 FROM concerns WHERE slug = $1`, [slug]))
  ) {
    slug = `${root}-${i++}`;
  }
  const row = await queryOne<{ id: string }>(
    `INSERT INTO concerns (name, slug, origin, is_active)
     VALUES ($1,$2,'ai',true)
     ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [clean, slug]
  );
  const created: ConcernCatRow = { id: row!.id, name: clean, slug, aliases: [], origin: "ai" };
  catalog.push(created);
  createdConcerns.push(clean);
  return created;
}

const NEUROTOXIN_PAGE_RE =
  /\b(botox|dysport|xeomin|daxxify|jeuveau|tox|neurotoxin|neuromodulator)\b/i;

const NEUROTOXIN_TREATMENT_AREAS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Forehead Lines", pattern: /\b(forehead lines?|horizontal forehead wrinkles?|forehead wrinkles?)\b/i },
  { name: "Frown Lines", pattern: /\b(frown lines?|between (?:the )?eyebrows?|glabellar lines?)\b/i },
  { name: "Crow's Feet", pattern: /\bcrow[’']?s\s+feet\b/i },
  { name: "Bunny Lines", pattern: /\bbunny lines?\b/i },
  { name: "Dimpled Chin", pattern: /\b(dimpled chin|chin dimpling)\b/i },
  { name: "Scowl Lines (11s)", pattern: /\b(scowl lines?|11s|eleven lines?)\b/i },
  { name: "Brow Lift", pattern: /\bbrow lift\b/i },
  { name: "Lip Flip", pattern: /\blip flip\b/i },
  { name: "Platysma (Vertical Neck Cords)", pattern: /\b(platysma|vertical neck cords?)\b/i },
  { name: "Hyperhidrosis", pattern: /\b(hyperhidrosis|excessive sweating)\b/i },
  { name: "Masseter (TMJ) / Face Slimming", pattern: /\b(masseter|tmj|face slimming)\b/i },
];

/** Deterministically detect neurotoxin-treated concern areas (forehead lines,
 *  crow's feet, …) from the text of pages that are about botox/tox/neurotoxin.
 *  These are high-precision concerns; emitted directly (no treatment pairing). */
function deterministicNeurotoxinConcerns(
  pages: Array<{ url: string; text: string }>
): DetectedConcern[] {
  const out: DetectedConcern[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const pageContext = `${page.url} ${page.text.slice(0, 1500)}`;
    if (!NEUROTOXIN_PAGE_RE.test(pageContext)) continue;
    for (const area of NEUROTOXIN_TREATMENT_AREAS) {
      if (!area.pattern.test(page.text)) continue;
      if (seen.has(area.name)) continue;
      seen.add(area.name);
      out.push({ name: area.name, source_url: page.url });
    }
  }
  return out;
}

export async function ingestTreatmentsAndConcernsByDomain(
  rawDomain: string
): Promise<TreatmentsConcernsResult> {
  const domain = websiteDomain(rawDomain);
  const started = Date.now();
  tcLog(domain, "start", { rawDomain });
  const base: TreatmentsConcernsResult = {
    domain,
    status: "failed",
    pagesFetched: 0,
    treatmentsFound: 0,
    servicesMatched: 0,
    servicesAuto: 0,
    servicesUnmatched: 0,
    concernsFound: 0,
    concernsSaved: 0,
    mappingsFound: 0,
    mappingsSaved: 0,
    createdConcerns: [],
    associations: [],
    modelUsed: "",
    usage: null,
  };

  const clinicIds = await findClinicsByDomain(domain);
  if (clinicIds.length === 0) {
    tcLog(domain, "skipped-no-clinic", { ms: Date.now() - started });
    return { ...base, status: "skipped", note: "no clinic for this domain" };
  }
  const clinicId = clinicIds[0];
  const clinic = await queryOne<{ slug: string; website: string | null }>(
    `SELECT slug, website FROM clinics WHERE id = $1`,
    [clinicId]
  );
  const slug = clinic?.slug;

  let collected: Awaited<ReturnType<typeof collectPagesAndCandidates>>;
  try {
    collected = await collectPagesAndCandidates(rawDomain, clinic?.website ?? null);
  } catch (err) {
    tcLog(domain, "collect-failed", {
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    });
    return {
      ...base,
      clinicId,
      slug,
      status: "skipped",
      note: err instanceof Error ? err.message : String(err),
    };
  }

  const [knownTreatments, concernCatalog] = await Promise.all([
    query<{ name: string }>(`SELECT name FROM services WHERE is_active = true ORDER BY name`),
    loadConcernCatalog(),
  ]);
  const knownConcerns = concernCatalog.map((c) => c.name);
  tcLog(domain, "catalog-loaded", {
    slug,
    pages: collected.pages.length,
    serviceCandidates: collected.serviceCandidates.length,
    knownTreatments: knownTreatments.length,
    knownConcerns: knownConcerns.length,
    ms: Date.now() - started,
  });

  const extracted = {
    treatments: [] as ExtractedTreatment[],
    concerns: [] as ExtractedStandaloneConcern[],
  };
  const usage = { input_tokens: 0, output_tokens: 0 };
  let modelUsed = "";
  const batches = pageBatches(collected.pages);
  tcLog(domain, "ai-batches-ready", {
    batches: batches.length,
    batchSizes: batches.map((b) => b.length),
    ms: Date.now() - started,
  });
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchChars = batch.reduce((sum, p) => sum + Math.min(p.text.length, PAGE_TEXT_CHAR_LIMIT), 0);
    const batchStarted = Date.now();
    tcLog(domain, "ai-batch-start", {
      batch: i + 1,
      batches: batches.length,
      pages: batch.length,
      chars: batchChars,
      ms: Date.now() - started,
    });
    const out = await extractClinicTreatmentsConcerns({
      domain,
      pages: batch,
      serviceCandidates: collected.serviceCandidates,
      knownTreatments: knownTreatments.map((t) => t.name),
      knownConcerns,
    });
    extracted.treatments.push(...out.treatments);
    extracted.concerns.push(...out.concerns);
    modelUsed ||= out.model;
    usage.input_tokens += out.usage?.input_tokens ?? 0;
    usage.output_tokens += out.usage?.output_tokens ?? 0;
    tcLog(domain, "ai-batch-done", {
      batch: i + 1,
      model: out.model,
      treatments: out.treatments.length,
      concerns: out.concerns.length,
      inputTokens: out.usage?.input_tokens ?? null,
      outputTokens: out.usage?.output_tokens ?? null,
      batchMs: Date.now() - batchStarted,
      ms: Date.now() - started,
    });
  }

  const urlByName = new Map(
    collected.serviceCandidates.map((s) => [s.name.trim().toLowerCase(), s.url ?? null])
  );
  const seenTreatments = new Set<string>();
  let services: SaveService[] = extracted.treatments
    .filter((t) => t.raw_name?.trim())
    .flatMap((t) =>
      normalizeServiceOutput({
        raw_name: t.raw_name.trim(),
        general_name: t.general_name?.trim() || null,
        general_category: t.category?.trim() || null,
        scraped_from_url:
          t.source_url?.trim() ||
          urlByName.get(t.raw_name.trim().toLowerCase()) ||
          collected.finalUrl,
        public_decision: t.public_decision,
        ignored: t.public_decision === "ignored",
      })
    )
    .filter((svc) => {
      const k = svc.raw_name.toLowerCase();
      if (seenTreatments.has(k)) return false;
      seenTreatments.add(k);
      return true;
    });

  for (const cand of collected.serviceCandidates) {
    const raw = cand.name.trim();
    if (!raw || seenTreatments.has(raw.toLowerCase())) continue;
    for (const svc of normalizeServiceOutput({
      raw_name: raw,
      general_name: raw,
      general_category: cand.category ?? null,
      scraped_from_url: cand.url ?? collected.finalUrl,
      public_decision: "public",
      ignored: false,
    })) {
      if (svc.ignored) continue;
      const k = svc.raw_name.toLowerCase();
      if (seenTreatments.has(k)) continue;
      seenTreatments.add(k);
      services.push(svc);
    }
  }

  services = services.filter((s) => !s.ignored && !isServiceNoise(s.raw_name));
  tcLog(domain, "service-refine-start", {
    inputServices: services.length,
    ms: Date.now() - started,
  });
  const refineStarted = Date.now();
  const refined = await refineClinicServices({
    domain,
    services: services.map((s) => ({
      raw_name: s.raw_name,
      general_name: s.general_name ?? null,
      category: s.general_category ?? null,
      source_url: s.scraped_from_url ?? null,
      public_decision: s.public_decision ?? "public",
    })),
    knownTreatments: knownTreatments.map((t) => t.name),
  });
  usage.input_tokens += refined.usage?.input_tokens ?? 0;
  usage.output_tokens += refined.usage?.output_tokens ?? 0;
  const seenRefined = new Set<string>();
  services = refined.data.services
    .flatMap((s) =>
      normalizeServiceOutput({
        raw_name: s.raw_name.trim(),
        general_name: s.general_name?.trim() || null,
        general_category: s.category?.trim() || null,
        scraped_from_url:
          s.source_url?.trim() ||
          urlByName.get(s.raw_name.trim().toLowerCase()) ||
          collected.finalUrl,
        public_decision: s.public_decision,
        ignored: s.public_decision === "ignored",
      })
    )
    .filter((svc) => {
      if (svc.ignored || isServiceNoise(svc.raw_name)) return false;
      const k = svc.raw_name.toLowerCase();
      if (seenRefined.has(k)) return false;
      seenRefined.add(k);
      return true;
    });
  tcLog(domain, "service-refine-done", {
    outputServices: services.length,
    model: refined.model,
    inputTokens: refined.usage?.input_tokens ?? null,
    outputTokens: refined.usage?.output_tokens ?? null,
    refineMs: Date.now() - refineStarted,
    ms: Date.now() - started,
  });

  // ── Build the concern set ──────────────────────────────────────────────────
  // Conditions-led sites (dedicated "Conditions We Treat" section): trust ONLY
  // concerns sourced from the condition pages (or with no explicit source) and
  // DROP anything the model pulled off a service/treatment page; also skip the
  // service-page neurotoxin heuristic. Services-led sites keep the full inference.
  const detected: DetectedConcern[] = [];
  for (const c of extracted.concerns) {
    const src = c.source_url?.trim() || null;
    if (collected.hasConditionsSection && src && !collected.concernPageKeys.has(pageUrlKey(src))) {
      continue; // sourced from a service/other page — ignore on conditions-led sites
    }
    detected.push({ name: c.general_name?.trim() || c.raw_phrase?.trim() || "", source_url: src });
  }
  if (!collected.hasConditionsSection) {
    detected.push(...deterministicNeurotoxinConcerns(collected.pages));
  }

  const createdConcerns: string[] = [];
  const standaloneConcernRows = new Map<string, {
    row: ConcernCatRow;
    raw_phrase: string;
    source_url: string | null;
  }>();
  for (const c of detected) {
    const cleanName = c.name?.trim();
    if (!cleanName || normalize(cleanName).length < 3) continue;
    if (isConcernNoise(cleanName)) continue; // treatments/procedures/chrome are not concerns
    const row = await resolveConcernRow(concernCatalog, createdConcerns, cleanName);
    if (!standaloneConcernRows.has(row.id)) {
      standaloneConcernRows.set(row.id, { row, raw_phrase: cleanName, source_url: c.source_url });
    }
  }
  tcLog(domain, "concerns-prepared", {
    hasConditionsSection: collected.hasConditionsSection,
    extractedConcerns: extracted.concerns.length,
    concernsToSave: standaloneConcernRows.size,
    ms: Date.now() - started,
  });

  // ── Degrade guard ──────────────────────────────────────────────────────────
  // If a partly-failed crawl came back with drastically less than what's already
  // stored, do NOT wipe good data — skip and keep the existing rows.
  const existing = await queryOne<{ svc: number; con: number }>(
    `SELECT
       (SELECT count(*) FROM clinic_services WHERE clinic_id = $1 AND is_active = true)::int AS svc,
       (SELECT count(*) FROM clinic_concerns WHERE clinic_id = $1 AND is_active = true AND source IN ('scraped','manual'))::int AS con`,
    [clinicId]
  );
  const crawlHealth = collected.pagesRequested > 0 ? collected.pagesFetchedOk / collected.pagesRequested : 1;
  const svcCollapse = (existing?.svc ?? 0) >= 5 && services.length < existing!.svc * 0.5;
  const conCollapse = (existing?.con ?? 0) >= 5 && standaloneConcernRows.size < existing!.con * 0.5;
  if (crawlHealth < 0.6 && (svcCollapse || conCollapse)) {
    tcLog(domain, "degrade-guard-skip", {
      crawlHealth, existing, newServices: services.length, newConcerns: standaloneConcernRows.size,
      ms: Date.now() - started,
    });
    return {
      ...base,
      clinicId,
      slug,
      status: "skipped",
      pagesFetched: collected.pages.length,
      note: `degraded crawl (health ${(crawlHealth * 100).toFixed(0)}%, ${collected.pagesFetchedOk}/${collected.pagesRequested} pages); kept existing data`,
    };
  }

  // ── Save services ──────────────────────────────────────────────────────────
  const providerRows = await query<{ name: string }>(
    `SELECT name FROM providers WHERE clinic_id = $1 AND is_active = true`,
    [clinicId]
  );
  const svcResult = await saveClinicServices(clinicId, services, {
    website: collected.finalUrl,
    providerNames: providerRows.map((p) => p.name),
    overwrite: true,
  });
  tcLog(domain, "services-saved", {
    inputServices: services.length,
    matched: svcResult.matched,
    auto: svcResult.auto,
    unmatched: svcResult.unmatched,
    ms: Date.now() - started,
  });

  // ── Save concerns (replace scraped membership; preserve manual/removed) ─────
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM clinic_concerns WHERE clinic_id = $1 AND source = 'scraped'`, [clinicId]);
    for (const { row } of standaloneConcernRows.values()) {
      await client.query(
        `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active)
         VALUES ($1, $2, 'scraped', true)
         ON CONFLICT (clinic_id, concern_id) DO UPDATE SET
           source = 'scraped',
           is_active = true,
           updated_at = NOW()
         WHERE clinic_concerns.source <> 'removed'`,
        [clinicId, row.id]
      );
    }
  });
  tcLog(domain, "saved", {
    concernsSaved: standaloneConcernRows.size,
    createdConcerns: createdConcerns.length,
    ms: Date.now() - started,
  });

  return {
    ...base,
    status: "saved",
    clinicId,
    slug,
    pagesFetched: collected.pages.length,
    treatmentsFound: services.length,
    servicesMatched: svcResult.matched,
    servicesAuto: svcResult.auto,
    servicesUnmatched: svcResult.unmatched,
    concernsFound: extracted.concerns.length,
    concernsSaved: standaloneConcernRows.size,
    mappingsFound: 0,
    mappingsSaved: 0,
    createdConcerns,
    associations: [],
    modelUsed,
    usage,
  };
}
