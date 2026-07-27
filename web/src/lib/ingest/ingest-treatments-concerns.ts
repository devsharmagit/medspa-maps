/**
 * Unified refresh for a clinic's treatments AND concerns — the SINGLE engine
 * behind all three surfaces that can change a clinic's menu:
 *
 *   /api/admin/clinics/ingest            (admin "Add Website with AI")
 *   /api/admin/g99-websites              (admin g99 Import button)
 *   /api/internal/rescrape/clinic/[id]   (the scheduled refresh)
 *
 * Collect website content, show the AI the live treatment/concern catalogs in
 * one call, then replace the scraped state and record what changed.
 *
 * Shape of a run: crawl and AI happen with no transaction held; every DB write
 * then happens inside ONE transaction, which also snapshots before/after and
 * writes the `clinic_refresh_runs` + `clinic_catalog_changes` history.
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
import { normalizeServiceOutput } from "@/lib/ingest/service-normalize";
import { refineClinicServices } from "@/lib/ingest/ai-refine-services";
import { extractClinicTreatmentsConcerns } from "@/lib/ingest/ai-extract-treatments-concerns";
import type {
  ExtractedStandaloneConcern,
  ExtractedTreatment,
} from "@/lib/ingest/ai-extract-treatments-concerns";
import { diffCatalog, type CatalogChange } from "@/lib/ingest/catalog-diff";
import {
  readCatalogSnapshot,
  writeCatalogChanges,
  writeRefreshRun,
} from "@/lib/ingest/change-log";

/** A concern the clinic treats, detected deterministically (not via the LLM). */
interface DetectedConcern { name: string; source_url: string | null }

const SERVICES_URL_RE = /\/(services?|treatments?|menu|procedures|what-we-offer)/i;
const SVC_CAND_CAP = 200;
const PAGE_CAP = 130;
const FETCH_URL_CAP = 150;
const FETCH_CONCURRENCY = 10;
const BATCH_CHAR_BUDGET = 70_000;
const PAGE_TEXT_CHAR_LIMIT = 6_000;
/** AI batches in flight at once — the API route budget is 300s (see route.ts). */
const AI_BATCH_CONCURRENCY = 3;

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

/** Which surface asked for this refresh — stored on the run row. */
export type RefreshTrigger = "admin_import" | "g99_import" | "cron_refresh" | "cli";

export interface TreatmentsConcernsOptions {
  /** Defaults to "cli". */
  trigger?: RefreshTrigger;
  /**
   * Wall-clock budget for crawl + AI. Exceeding it is treated as a DEGRADED
   * crawl — the save is skipped rather than persisting a half-crawled site.
   */
  deadlineMs?: number;
}

export interface TreatmentsConcernsResult {
  domain: string;
  status: "saved" | "skipped" | "failed";
  clinicId?: string;
  slug?: string;
  /** Set once a run row is written; null when we bailed before that. */
  runId?: string | null;
  pagesFetched: number;
  treatmentsFound: number;
  servicesMatched: number;
  servicesAuto: number;
  /** scraped names that resolved to nothing and were dropped */
  servicesDropped: number;
  concernsFound: number;
  concernsSaved: number;
  createdConcerns: string[];
  /** Canonical catalog rows gained/lost this run (empty on a first import). */
  added: CatalogChange[];
  removed: CatalogChange[];
  modelUsed: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
  note?: string;
}

function emptyResult(domain: string): TreatmentsConcernsResult {
  return {
    domain,
    status: "failed",
    runId: null,
    pagesFetched: 0,
    treatmentsFound: 0,
    servicesMatched: 0,
    servicesAuto: 0,
    servicesDropped: 0,
    concernsFound: 0,
    concernsSaved: 0,
    createdConcerns: [],
    added: [],
    removed: [],
    modelUsed: "",
    usage: null,
  };
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

async function collectPagesAndCandidates(
  rawDomain: string,
  clinicWebsite: string | null,
  deadlineAt: number | null = null
): Promise<{
  finalUrl: string;
  pages: Array<{ url: string; text: string }>;
  serviceCandidates: Array<{ name: string; category?: string | null; url?: string | null }>;
  /** true when the site has a dedicated conditions/concerns section (diagnostic only). */
  hasConditionsSection: boolean;
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
      // Flat budget, not a function of nav size: big catalogues (cienegaspa.com
      // has 105 service pages, only ~80 of them in the nav) live in the sitemap.
      servicePages: 110,
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
    // Out of budget: stop crawling and let the caller's guard treat the partial
    // page set as a degraded crawl rather than persisting half a site.
    if (deadlineAt && Date.now() > deadlineAt) {
      tcLog(domain, "fetch-deadline", { attempted, fetched, pages: pages.length });
      break;
    }
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

const concernTokens = (s: string): string[] => normalize(s).split(" ").filter(Boolean);
const isTokenPrefix = (short: string[], long: string[]): boolean =>
  short.length >= 2 && short.length < long.length && short.every((t, i) => t === long[i]);

/** Match an existing catalog row, or null. Never creates. */
function matchExistingConcern(catalog: ConcernCatRow[], name: string): ConcernCatRow | null {
  const n = normalize(name);
  const exact = catalog.find(
    (c) => normalize(c.name) === n || normalize(c.slug) === n || c.aliases.some((a) => normalize(a) === n)
  );
  if (exact) return exact;
  const fuzzy = bestCatalogMatch(name, catalog, 0.82);
  if (fuzzy) return catalog.find((c) => c.slug === fuzzy.entry.slug)!;
  // Token-prefix containment (same rule as ingest-concerns.ts): "Crow's Feet
  // Around the Eyes" resolves onto the existing "Crow's Feet" instead of
  // minting a near-duplicate AI row.
  const gt = concernTokens(name);
  return (
    catalog.find(
      (c) => isTokenPrefix(concernTokens(c.name), gt) || isTokenPrefix(gt, concernTokens(c.name))
    ) ?? null
  );
}

/**
 * Split a compound the model emitted despite prompt rule 11 ("Spider Veins,
 * Rosacea & Redness") into its components — but ONLY when every part already
 * exists in the catalog. That proves it really is a list of known concerns and
 * not a legitimately hyphenated/compound name like "Wrinkles & Fine Lines" or
 * "Masseter (TMJ) / Face Slimming", which must be left whole.
 */
function splitCompoundConcern(catalog: ConcernCatRow[], name: string): ConcernCatRow[] | null {
  if (matchExistingConcern(catalog, name)) return null; // already a known concern — never split
  const parts = name
    .split(/\s*(?:,|&|\/|\band\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const rows: ConcernCatRow[] = [];
  for (const part of parts) {
    const row = matchExistingConcern(catalog, part);
    if (!row) return null; // an unknown part — keep the original string intact
    if (!rows.some((r) => r.id === row.id)) rows.push(row);
  }
  return rows.length >= 2 ? rows : null;
}

async function resolveConcernRow(
  catalog: ConcernCatRow[],
  createdConcerns: string[],
  name: string
): Promise<ConcernCatRow> {
  const existing = matchExistingConcern(catalog, name);
  if (existing) return existing;

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
  // Map the PROCEDURE to the CONCERN it treats — "Brow Lift"/"Lip Flip" are
  // treatments and `isConcernNoise` rejects them, so emitting them here would
  // just be discarded downstream.
  { name: "Drooping Brows", pattern: /\bbrow lift\b/i },
  { name: "Thin Lips", pattern: /\blip flip\b/i },
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

/**
 * Refresh treatments + concerns for the clinic that owns `rawDomain`.
 *
 * A thin wrapper over the by-id function below, for the import path and the CLI
 * where a URL is what the caller has. Prefer the by-id form whenever the clinic
 * is already known: a domain can legitimately map to more than one clinic row
 * (see DUPLICATE-DOMAINS.md) and this wrapper has to pick one.
 */
export async function ingestTreatmentsAndConcernsByDomain(
  rawDomain: string,
  opts: TreatmentsConcernsOptions = {}
): Promise<TreatmentsConcernsResult> {
  const domain = websiteDomain(rawDomain);
  const clinicIds = await findClinicsByDomain(domain);
  if (clinicIds.length === 0) {
    tcLog(domain, "skipped-no-clinic", {});
    return { ...emptyResult(domain), status: "skipped", note: "no clinic for this domain" };
  }
  if (clinicIds.length > 1) {
    tcLog(domain, "ambiguous-domain", { clinics: clinicIds.length, using: clinicIds[0] });
  }
  return ingestTreatmentsAndConcernsForClinic(clinicIds[0], opts);
}

/**
 * Refresh treatments + concerns for ONE clinic, addressed by its id.
 *
 * This is the single engine behind all three surfaces — the admin
 * "Add Website with AI" import, the g99-websites Import button, and the
 * scheduled refresh — so a clinic's menu means the same thing regardless of
 * which one last touched it.
 */
export async function ingestTreatmentsAndConcernsForClinic(
  clinicId: string,
  opts: TreatmentsConcernsOptions = {}
): Promise<TreatmentsConcernsResult> {
  const started = Date.now();
  const deadlineAt = opts.deadlineMs ? started + opts.deadlineMs : null;
  const trigger: RefreshTrigger = opts.trigger ?? "cli";

  const clinic = await queryOne<{ slug: string; website: string | null }>(
    `SELECT slug, website FROM clinics WHERE id = $1`,
    [clinicId]
  );
  if (!clinic) {
    return { ...emptyResult(""), clinicId, status: "skipped", note: "clinic not found" };
  }
  if (!clinic.website?.trim()) {
    return {
      ...emptyResult(""),
      clinicId,
      slug: clinic.slug,
      status: "skipped",
      note: "clinic has no website",
    };
  }

  const domain = websiteDomain(clinic.website);
  const slug = clinic.slug;
  const base = emptyResult(domain);
  tcLog(domain, "start", { clinicId, slug, trigger });

  let collected: Awaited<ReturnType<typeof collectPagesAndCandidates>>;
  try {
    collected = await collectPagesAndCandidates(domain, clinic.website, deadlineAt);
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
  // Batches are independent — the only shared state is the two output arrays,
  // which are order-insensitive. Run AI_BATCH_CONCURRENCY at a time so a large
  // catalogue (10+ batches) still lands inside the route's 300s budget.
  let aiDeadlineHit = false;
  let batchesFailed = 0;
  for (let i = 0; i < batches.length; i += AI_BATCH_CONCURRENCY) {
    if (deadlineAt && Date.now() > deadlineAt) {
      aiDeadlineHit = true;
      tcLog(domain, "ai-deadline", { completedBatches: i, batches: batches.length });
      break;
    }
    const wave = batches.slice(i, i + AI_BATCH_CONCURRENCY);
    const outs = await Promise.all(
      wave.map(async (batch, j) => {
        const n = i + j + 1;
        const batchChars = batch.reduce((sum, p) => sum + Math.min(p.text.length, PAGE_TEXT_CHAR_LIMIT), 0);
        const batchStarted = Date.now();
        tcLog(domain, "ai-batch-start", {
          batch: n,
          batches: batches.length,
          pages: batch.length,
          chars: batchChars,
          ms: Date.now() - started,
        });
        // One batch failing must not abort the clinic. A provider timeout on
        // batch 7 of 11 used to throw all the way out and lose the whole run;
        // now the batch is dropped and the degrade guards below decide whether
        // what survived is enough to save.
        let out: Awaited<ReturnType<typeof extractClinicTreatmentsConcerns>>;
        try {
          out = await extractClinicTreatmentsConcerns({
            domain,
            pages: batch,
            serviceCandidates: collected.serviceCandidates,
            knownTreatments: knownTreatments.map((t) => t.name),
            knownConcerns,
          });
        } catch (err) {
          batchesFailed++;
          tcLog(domain, "ai-batch-failed", {
            batch: n,
            error: err instanceof Error ? err.message : String(err),
            batchMs: Date.now() - batchStarted,
            ms: Date.now() - started,
          });
          return null;
        }
        tcLog(domain, "ai-batch-done", {
          batch: n,
          model: out.model,
          treatments: out.treatments.length,
          concerns: out.concerns.length,
          inputTokens: out.usage?.input_tokens ?? null,
          outputTokens: out.usage?.output_tokens ?? null,
          batchMs: Date.now() - batchStarted,
          ms: Date.now() - started,
        });
        return out;
      })
    );
    for (const out of outs) {
      if (!out) continue;
      extracted.treatments.push(...out.treatments);
      extracted.concerns.push(...out.concerns);
      modelUsed ||= out.model;
      usage.input_tokens += out.usage?.input_tokens ?? 0;
      usage.output_tokens += out.usage?.output_tokens ?? 0;
    }
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
  // Every crawled page is a valid concern source. This used to drop concerns
  // sourced off treatment pages whenever `hasConditionsSection` was true, which
  // silently binned ~90% of them on treatment-first sites (cienegaspa.com: 6
  // concerns saved out of ~78 named on the site). Keeping treatments out of the
  // concern list is already the job of the extraction prompt (rules 3/4) and
  // `isConcernNoise` below — a source-URL allowlist is the wrong tool for it.
  const detected: DetectedConcern[] = [];
  for (const c of extracted.concerns) {
    const src = c.source_url?.trim() || null;
    detected.push({ name: c.general_name?.trim() || c.raw_phrase?.trim() || "", source_url: src });
  }
  // Regex-gated on neurotoxin pages already, so it is safe on both site shapes.
  detected.push(...deterministicNeurotoxinConcerns(collected.pages));

  const createdConcerns: string[] = [];
  const standaloneConcernRows = new Map<string, {
    row: ConcernCatRow;
    raw_phrase: string;
    source_url: string | null;
  }>();
  let compoundsSplit = 0;
  for (const c of detected) {
    const cleanName = c.name?.trim();
    if (!cleanName || normalize(cleanName).length < 3) continue;
    if (isConcernNoise(cleanName)) continue; // treatments/procedures/goals are not concerns
    // "Spider Veins, Rosacea & Redness" -> three known rows, not one new row.
    const split = splitCompoundConcern(concernCatalog, cleanName);
    const rows = split ?? [await resolveConcernRow(concernCatalog, createdConcerns, cleanName)];
    if (split) compoundsSplit++;
    for (const row of rows) {
      if (!standaloneConcernRows.has(row.id)) {
        standaloneConcernRows.set(row.id, {
          row,
          raw_phrase: split ? row.name : cleanName,
          source_url: c.source_url,
        });
      }
    }
  }
  tcLog(domain, "concerns-prepared", {
    hasConditionsSection: collected.hasConditionsSection,
    extractedConcerns: extracted.concerns.length,
    compoundsSplit,
    concernsToSave: standaloneConcernRows.size,
    ms: Date.now() - started,
  });

  // ── Degrade guards ─────────────────────────────────────────────────────────
  // A transient outage or a markup change must never look like "this clinic
  // dropped its whole menu". Three independent aborts, all of which leave the
  // stored data alone and record a `skipped` run:
  const existing = await queryOne<{ svc: number; con: number }>(
    `SELECT
       (SELECT count(*) FROM clinic_services WHERE clinic_id = $1 AND is_active = true)::int AS svc,
       (SELECT count(*) FROM clinic_concerns WHERE clinic_id = $1 AND is_active = true AND source IN ('scraped','manual'))::int AS con`,
    [clinicId]
  );
  const priorSvc = existing?.svc ?? 0;
  const priorCon = existing?.con ?? 0;
  const crawlHealth = collected.pagesRequested > 0 ? collected.pagesFetchedOk / collected.pagesRequested : 1;

  const skip = async (note: string): Promise<TreatmentsConcernsResult> => {
    tcLog(domain, "degrade-guard-skip", {
      note, crawlHealth, priorSvc, priorCon,
      newServices: services.length, newConcerns: standaloneConcernRows.size,
      ms: Date.now() - started,
    });
    const runId = await withTransaction((client) =>
      writeRefreshRun(client, {
        clinicId, trigger, status: "skipped",
        crawlHealth,
        pagesRequested: collected.pagesRequested,
        pagesFetched: collected.pagesFetchedOk,
        servicesBefore: priorSvc, servicesAfter: priorSvc,
        concernsBefore: priorCon, concernsAfter: priorCon,
        note, startedAt: new Date(started),
      })
    );
    return {
      ...base, clinicId, slug, runId, status: "skipped",
      pagesFetched: collected.pages.length, note,
    };
  };

  // 0. Every AI batch failed — there is no extraction to reason about at all.
  if (batches.length > 0 && batchesFailed === batches.length) {
    return skip(`all ${batches.length} extraction batch(es) failed; kept existing data`);
  }

  // 1. Nothing parsed at all, but the clinic already had a menu. A reachable
  //    site whose markup changed yields crawlHealth 1.0, so the proportional
  //    guard below never fires — this unconditional one is what saves the menu.
  if (services.length === 0 && priorSvc > 0) {
    return skip(`no treatments parsed (site reachable, ${collected.pagesFetchedOk} pages); kept existing data`);
  }
  // 2. A near-total collapse is a parse failure regardless of crawl health.
  if (priorSvc >= 5 && services.length < priorSvc * 0.2) {
    return skip(`treatments collapsed ${priorSvc} → ${services.length} (>80%); kept existing data`);
  }
  // 3. A partly-failed crawl plus a halving of either list.
  const svcCollapse = priorSvc >= 5 && services.length < priorSvc * 0.5;
  const conCollapse = priorCon >= 5 && standaloneConcernRows.size < priorCon * 0.5;
  if (crawlHealth < 0.6 && (svcCollapse || conCollapse)) {
    return skip(
      `degraded crawl (health ${(crawlHealth * 100).toFixed(0)}%, ` +
        `${collected.pagesFetchedOk}/${collected.pagesRequested} pages); kept existing data`
    );
  }
  // 4. The wall-clock budget ran out, so the page set or the extraction is
  //    incomplete. Saving a partial crawl is exactly what the guards exist to
  //    prevent, so treat it as degraded — unless the clinic has nothing stored
  //    yet, where partial data still beats none.
  if ((aiDeadlineHit || (deadlineAt && Date.now() > deadlineAt)) && priorSvc > 0) {
    return skip(
      aiDeadlineHit
        ? `refresh budget exceeded during extraction; kept existing data`
        : `refresh budget exceeded before save; kept existing data`
    );
  }

  // ── Save + log, atomically ─────────────────────────────────────────────────
  // Crawl and AI are done; everything that touches the DB happens in ONE
  // transaction so a failure can never leave a half-written menu, and so the
  // before-snapshot is read on the same connection that performs the write (a
  // separate read would let a concurrent admin edit look like a change).
  const providerRows = await query<{ name: string }>(
    `SELECT name FROM providers WHERE clinic_id = $1 AND is_active = true`,
    [clinicId]
  );

  const saved = await withTransaction(async (client) => {
    const before = await readCatalogSnapshot(client, clinicId);

    const svcResult = await saveClinicServices(clinicId, services, {
      website: collected.finalUrl,
      providerNames: providerRows.map((p) => p.name),
      overwrite: true,
      client,
    });

    // Replace scraped concern membership; admin `manual`/`removed` rows survive.
    await client.query(
      `DELETE FROM clinic_concerns WHERE clinic_id = $1 AND source = 'scraped'`,
      [clinicId]
    );
    const concernIds = [...standaloneConcernRows.values()].map((c) => c.row.id);
    if (concernIds.length > 0) {
      await client.query(
        `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active)
         SELECT $1, id, 'scraped', true FROM unnest($2::uuid[]) AS t(id)
         ON CONFLICT (clinic_id, concern_id) DO UPDATE SET
           source = 'scraped',
           is_active = true,
           updated_at = NOW()
         WHERE clinic_concerns.source <> 'removed'`,
        [clinicId, concernIds]
      );
    }

    const after = await readCatalogSnapshot(client, clinicId);
    const delta = diffCatalog(before, after);

    const runId = await writeRefreshRun(client, {
      clinicId, trigger, status: "saved",
      crawlHealth,
      pagesRequested: collected.pagesRequested,
      pagesFetched: collected.pagesFetchedOk,
      servicesBefore: before.services.length, servicesAfter: after.services.length,
      concernsBefore: before.concerns.length, concernsAfter: after.concerns.length,
      // Surface a partial extraction on the history page — the counts alone
      // would look like a real menu shrink.
      note: batchesFailed > 0
        ? `saved with ${batchesFailed}/${batches.length} extraction batch(es) failed`
        : null,
      startedAt: new Date(started),
    });
    await writeCatalogChanges(client, runId, clinicId, delta);

    await client.query(
      `UPDATE clinics SET last_scraped_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [clinicId]
    );

    return { svcResult, delta, runId, firstImport: before.services.length === 0 };
  });

  tcLog(domain, "saved", {
    runId: saved.runId,
    matched: saved.svcResult.matched,
    auto: saved.svcResult.auto,
    dropped: saved.svcResult.dropped,
    concernsSaved: standaloneConcernRows.size,
    createdConcerns: createdConcerns.length,
    added: saved.delta.added.length,
    removed: saved.delta.removed.length,
    firstImport: saved.firstImport,
    ms: Date.now() - started,
  });

  return {
    ...base,
    status: "saved",
    clinicId,
    slug,
    runId: saved.runId,
    pagesFetched: collected.pages.length,
    treatmentsFound: services.length,
    servicesMatched: saved.svcResult.matched,
    servicesAuto: saved.svcResult.auto,
    servicesDropped: saved.svcResult.dropped,
    concernsFound: extracted.concerns.length,
    concernsSaved: standaloneConcernRows.size,
    createdConcerns,
    added: saved.delta.added,
    removed: saved.delta.removed,
    modelUsed,
    usage,
  };
}
