/**
 * backfill-services-heuristic.ts — populate clinic_services WITHOUT any AI call.
 *
 *   bun --env-file=.env scripts/backfill-services-heuristic.ts [domain ...]
 *
 * Unblocks treatment-search / Popular Treatments when the Anthropic account has
 * no credit: scrapes each clinic's nav + discovered services page for real
 * service names (extractServicesFromNav / extractServiceAnchors / extractServices
 * — the same heuristic extractors the AI pipeline uses as its fallback), then
 * resolves each raw name to a canonical treatment via the existing deterministic
 * matchService()/bestCatalogMatch() (curated 15 + aliases, then the live DB
 * catalog). No `general_name` inference — unmatched raw names are still stored
 * (service_id NULL), never dropped.
 *
 * Additive-only: only inserts/updates clinic_services rows (upsert on
 * (clinic_id, raw_name)); does not touch clinics/locations/images/providers, and
 * does not delete anything. Safe to re-run.
 *
 * With no args, runs against every active clinic with a website. Needs
 * DATABASE_URL only (no ANTHROPIC_API_KEY).
 */

import pool, { query } from "../src/lib/db";
import { fetchHtml, load, normalizeUrl } from "../src/lib/scraper/utils";
import {
  extractServicesFromNav,
  extractServiceAnchors,
  extractServices,
} from "../src/lib/scraper/services";
import type { ScrapedService } from "../src/lib/scraper/types";
import { discoverContentPages } from "../src/lib/ingest/discover";
import { matchService, bestCatalogMatch, isLikelyNoise } from "../src/lib/taxonomy/canonical";

const SERVICES_URL_RE = /\/(services?|treatments?|menu|procedures|what-we-offer)/i;

interface ClinicRow {
  id: string;
  slug: string;
  website: string;
}

type CatRow = { id: string; name: string; slug: string; aliases: string[] };

async function loadCatalog(): Promise<CatRow[]> {
  const rows = await query<{ id: string; name: string; slug: string; aliases: string[] | null }>(
    `SELECT id, name, slug, COALESCE(aliases, '{}') AS aliases FROM services WHERE is_active = true`
  );
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, aliases: r.aliases ?? [] }));
}

async function backfillClinic(clinic: ClinicRow, catalog: CatRow[]): Promise<{
  matched: number; auto: number; unmatched: number; total: number;
}> {
  const homeUrl = normalizeUrl(clinic.website);
  const home = await fetchHtml(homeUrl);
  if (!home) return { matched: 0, auto: 0, unmatched: 0, total: 0 };
  const $home = load(home.html);
  const finalUrl = home.finalUrl || homeUrl;

  const raw: ScrapedService[] = [];
  const seen = new Set<string>();
  const add = (list: ScrapedService[]) => {
    for (const s of list) {
      const key = s.name?.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      raw.push(s);
    }
  };

  add(extractServicesFromNav($home, finalUrl));
  add(extractServiceAnchors($home, finalUrl));

  for (const u of await discoverContentPages($home, finalUrl)) {
    const r = await fetchHtml(u);
    if (!r) continue;
    const $p = load(r.html);
    add(extractServicesFromNav($p, u));
    if (SERVICES_URL_RE.test(u)) {
      add(extractServices($p, u));
      add(extractServiceAnchors($p, u));
    }
  }

  let matched = 0, auto = 0, unmatched = 0;
  const catBySlug = new Map(catalog.map((c) => [c.slug, c]));

  for (const s of raw) {
    const name = s.name?.trim();
    if (!name || isLikelyNoise(name)) continue;

    let serviceId: string | null = null;
    let confidence = 0;
    let status: "matched" | "auto" | "unmatched";

    const curated = matchService(name);
    const curatedRow = curated.slug ? catBySlug.get(curated.slug) : undefined;
    if (curatedRow) {
      serviceId = curatedRow.id;
      confidence = curated.confidence;
      status = curated.confidence >= 1 ? "matched" : "auto";
    } else {
      const hit = bestCatalogMatch(name, catalog);
      if (hit) {
        serviceId = catBySlug.get(hit.entry.slug)?.id ?? null;
        confidence = hit.confidence;
        status = hit.confidence >= 1 ? "matched" : "auto";
      } else {
        status = "unmatched";
      }
    }

    if (status === "matched") matched++;
    else if (status === "auto") auto++;
    else unmatched++;

    await query(
      `INSERT INTO clinic_services
         (clinic_id, service_id, raw_name, data_source, scraped_from_url, last_scraped_at, match_status, match_confidence)
       VALUES ($1,$2,$3,'scraped',$4,NOW(),$5,$6)
       ON CONFLICT (clinic_id, raw_name) DO UPDATE SET
         service_id = EXCLUDED.service_id,
         match_status = EXCLUDED.match_status,
         match_confidence = EXCLUDED.match_confidence,
         last_scraped_at = NOW(),
         updated_at = NOW()`,
      [clinic.id, serviceId, name, s.scraped_from_url ?? finalUrl, status, confidence || null]
    );
  }

  return { matched, auto, unmatched, total: matched + auto + unmatched };
}

async function main() {
  const domains = process.argv.slice(2);
  const clinics = domains.length
    ? await query<ClinicRow>(
        `SELECT id, slug, website FROM clinics
          WHERE is_active = true AND website IS NOT NULL
            AND lower(regexp_replace(regexp_replace(website,'^https?://',''),'^www\\.','')) = ANY($1)`,
        [domains.map((d) => d.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase())]
      )
    : await query<ClinicRow>(
        `SELECT id, slug, website FROM clinics WHERE is_active = true AND website IS NOT NULL ORDER BY created_at`
      );

  if (clinics.length === 0) {
    console.log("No matching clinics found.");
    await pool.end();
    return;
  }

  const catalog = await loadCatalog();
  console.log(`catalog: ${catalog.length} active services`);

  for (const c of clinics) {
    process.stdout.write(`→ ${c.slug} … `);
    try {
      const r = await backfillClinic(c, catalog);
      console.log(`matched=${r.matched} auto=${r.auto} unmatched=${r.unmatched} total=${r.total}`);
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("→ Refreshing clinic_search_view …");
  await query("REFRESH MATERIALIZED VIEW public.clinic_search_view");
  await pool.end();
}

main().catch(async (err) => {
  console.error("✗ backfill failed:", err);
  await pool.end();
  process.exit(1);
});
