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
import { bestCatalogMatch, fuzzyScore, isServiceNoise, normalize, type CatalogEntry } from "@/lib/taxonomy/canonical";
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
  ExtractedTreatmentConcernMapping,
} from "@/lib/ingest/ai-extract-treatments-concerns";

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

interface ClinicServiceRow {
  service_id: string | null;
  raw_name: string;
  canonical_name: string | null;
  scraped_from_url: string | null;
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

async function ensureClinicServiceConcernTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS clinic_service_concerns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      concern_id uuid NOT NULL REFERENCES concerns(id) ON DELETE CASCADE,
      source text NOT NULL DEFAULT 'scraped',
      raw_service_name text,
      raw_concern_name text,
      source_url text,
      is_active boolean NOT NULL DEFAULT true,
      extracted_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (clinic_id, service_id, concern_id, source)
    )`
  );
  await query(`CREATE INDEX IF NOT EXISTS idx_csc_clinic ON clinic_service_concerns (clinic_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_csc_service ON clinic_service_concerns (service_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_csc_concern ON clinic_service_concerns (concern_id)`);
}

function pushPage(
  pages: Array<{ url: string; text: string }>,
  seen: Set<string>,
  url: string,
  text: string
): void {
  const key = url.replace(/\/+$/, "").toLowerCase();
  if (seen.has(key) || pages.length >= PAGE_CAP) return;
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
  clinicWebsite: string | null
): Promise<{
  finalUrl: string;
  pages: Array<{ url: string; text: string }>;
  serviceCandidates: Array<{ name: string; category?: string | null; url?: string | null }>;
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
  pushPage(pages, seenPages, finalUrl, htmlToText($home));

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
  const urls = dedupeUrls([
    ...neurotoxinUrls,
    ...navServiceUrls,
    ...concernDiscovery.servicePages,
    ...concernDiscovery.concernPages,
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
      pushPage(pages, seenPages, r.finalUrl || u, htmlToText($p));
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
    ms: Date.now() - started,
  });

  return { finalUrl, pages, serviceCandidates };
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
  const aliases = [...new Set([normalize(clean)].filter(Boolean))];
  const row = await queryOne<{ id: string }>(
    `INSERT INTO concerns (name, slug, aliases, data_source, origin, is_published, is_active)
     VALUES ($1,$2,$3,'scraped','ai',false,true)
     ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [clean, slug, aliases]
  );
  const created: ConcernCatRow = { id: row!.id, name: clean, slug, aliases, origin: "ai" };
  catalog.push(created);
  createdConcerns.push(clean);
  return created;
}

function findServiceForMapping(
  mapping: ExtractedTreatmentConcernMapping,
  services: ClinicServiceRow[]
): ClinicServiceRow | null {
  const names = [
    mapping.service_raw_name,
    mapping.service_general_name,
  ].filter((v): v is string => !!v && v.trim().length > 0);
  let best: { row: ClinicServiceRow; score: number } | null = null;
  for (const name of names) {
    const n = normalize(name);
    if (!n) continue;
    for (const row of services) {
      if (!row.service_id) continue;
      const candidates = [row.raw_name, row.canonical_name].filter((v): v is string => !!v);
      for (const cand of candidates) {
        const c = normalize(cand);
        if (!c) continue;
        const score = c === n || c.includes(n) || n.includes(c) ? 1 : fuzzyScore(c, n);
        if (!best || score > best.score) best = { row, score };
      }
    }
  }
  if (best && best.score >= 0.72) return best.row;
  if (mapping.source_url) {
    const urlKey = mapping.source_url.replace(/\/+$/, "").toLowerCase();
    const byUrl = services.find(
      (s) => s.service_id && s.scraped_from_url?.replace(/\/+$/, "").toLowerCase() === urlKey
    );
    if (byUrl) return byUrl;
  }
  return null;
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

function urlKey(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function serviceForPage(url: string, services: ClinicServiceRow[]): ClinicServiceRow | null {
  const pageKey = urlKey(url);
  return (
    services.find((s) => s.service_id && s.scraped_from_url && urlKey(s.scraped_from_url) === pageKey) ??
    null
  );
}

function deterministicNeurotoxinMappings(
  pages: Array<{ url: string; text: string }>,
  services: ClinicServiceRow[]
): ExtractedTreatmentConcernMapping[] {
  const mappings: ExtractedTreatmentConcernMapping[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const service = serviceForPage(page.url, services);
    if (!service) continue;

    const serviceName = service.canonical_name || service.raw_name;
    const pageContext = `${page.url} ${service.raw_name} ${service.canonical_name ?? ""} ${page.text.slice(0, 1000)}`;
    if (!NEUROTOXIN_PAGE_RE.test(pageContext)) continue;

    for (const area of NEUROTOXIN_TREATMENT_AREAS) {
      if (!area.pattern.test(page.text)) continue;
      const key = `${page.url}|${serviceName}|${area.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mappings.push({
        service_raw_name: service.raw_name,
        service_general_name: serviceName,
        concern_raw_phrase: area.name,
        concern_general_name: area.name,
        source_url: page.url,
      });
    }
  }

  return mappings;
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

  await ensureClinicServiceConcernTable();
  tcLog(domain, "table-ready", { ms: Date.now() - started });

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
    mappings: [] as ExtractedTreatmentConcernMapping[],
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
    extracted.mappings.push(...out.mappings);
    modelUsed ||= out.model;
    usage.input_tokens += out.usage?.input_tokens ?? 0;
    usage.output_tokens += out.usage?.output_tokens ?? 0;
    tcLog(domain, "ai-batch-done", {
      batch: i + 1,
      model: out.model,
      treatments: out.treatments.length,
      concerns: out.concerns.length,
      mappings: out.mappings.length,
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

  const clinicServices = await query<ClinicServiceRow>(
    `SELECT cs.service_id, cs.raw_name, s.name AS canonical_name, cs.scraped_from_url
       FROM clinic_services cs
       LEFT JOIN services s ON s.id = cs.service_id
      WHERE cs.clinic_id = $1 AND cs.is_active = true`,
    [clinicId]
  );
  const deterministicMappings = deterministicNeurotoxinMappings(collected.pages, clinicServices);
  const allMappings = [...extracted.mappings, ...deterministicMappings];
  tcLog(domain, "mappings-prepared", {
    aiMappings: extracted.mappings.length,
    deterministicMappings: deterministicMappings.length,
    clinicServices: clinicServices.length,
    ms: Date.now() - started,
  });

  const createdConcerns: string[] = [];
  const standaloneConcernRows = new Map<string, {
    row: ConcernCatRow;
    raw_phrase: string;
    source_url: string | null;
  }>();
  const associations: PersistedTreatmentConcern[] = [];
  const seenAssoc = new Set<string>();
  const addStandaloneConcern = async (
    rawPhrase: string,
    generalName: string,
    sourceUrl: string | null
  ) => {
    const cleanName = generalName?.trim() || rawPhrase?.trim();
    if (!cleanName || normalize(cleanName).length < 3) return;
    const row = await resolveConcernRow(concernCatalog, createdConcerns, cleanName);
    if (!standaloneConcernRows.has(row.id)) {
      standaloneConcernRows.set(row.id, {
        row,
        raw_phrase: rawPhrase || row.name,
        source_url: sourceUrl,
      });
    }
  };

  for (const concern of extracted.concerns) {
    await addStandaloneConcern(concern.raw_phrase, concern.general_name, concern.source_url);
  }

  for (const mapping of allMappings) {
    await addStandaloneConcern(mapping.concern_raw_phrase, mapping.concern_general_name, mapping.source_url);
    const svc = findServiceForMapping(mapping, clinicServices);
    if (!svc?.service_id) continue;
    const concernName = mapping.concern_general_name?.trim() || mapping.concern_raw_phrase?.trim();
    if (!concernName || normalize(concernName).length < 3) continue;
    const concern = await resolveConcernRow(concernCatalog, createdConcerns, concernName);
    const key = `${svc.service_id}|${concern.id}`;
    if (seenAssoc.has(key)) continue;
    seenAssoc.add(key);
    associations.push({
      service_id: svc.service_id,
      service_name: svc.canonical_name || svc.raw_name,
      concern_id: concern.id,
      concern_name: concern.name,
      raw_service_name: mapping.service_raw_name || svc.raw_name,
      raw_concern_name: mapping.concern_raw_phrase,
      source_url: mapping.source_url,
    });
  }

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM clinic_concern_evidence WHERE clinic_id = $1`, [clinicId]);
    await client.query(`DELETE FROM clinic_service_concerns WHERE clinic_id = $1 AND source = 'scraped'`, [clinicId]);
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

    for (const assoc of associations) {
      await client.query(
        `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active)
         VALUES ($1, $2, 'scraped', true)
         ON CONFLICT (clinic_id, concern_id) DO UPDATE SET
           source = 'scraped',
           is_active = true,
           updated_at = NOW()
         WHERE clinic_concerns.source <> 'removed'`,
        [clinicId, assoc.concern_id]
      );
      await client.query(
        `INSERT INTO clinic_service_concerns
           (clinic_id, service_id, concern_id, source, raw_service_name, raw_concern_name, source_url, is_active)
         VALUES ($1,$2,$3,'scraped',$4,$5,$6,true)
         ON CONFLICT (clinic_id, service_id, concern_id, source) DO UPDATE SET
           raw_service_name = EXCLUDED.raw_service_name,
           raw_concern_name = EXCLUDED.raw_concern_name,
           source_url = EXCLUDED.source_url,
           is_active = true,
           updated_at = NOW()`,
        [
          clinicId,
          assoc.service_id,
          assoc.concern_id,
          assoc.raw_service_name,
          assoc.raw_concern_name,
          assoc.source_url,
        ]
      );
    }
  });
  tcLog(domain, "saved", {
    standaloneConcerns: standaloneConcernRows.size,
    associations: associations.length,
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
    mappingsFound: allMappings.length,
    mappingsSaved: associations.length,
    createdConcerns,
    associations,
    modelUsed,
    usage,
  };
}
