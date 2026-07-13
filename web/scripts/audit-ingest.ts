/**
 * audit-ingest.ts — read-only audit + optional repair for treatment/concern
 * ingestion on one clinic/domain.
 *
 *   bun --env-file=.env scripts/audit-ingest.ts ruma.com --ai-dry-run
 *   bun --env-file=.env scripts/audit-ingest.ts ruma.com --repair
 *
 * Default is read-only. --repair re-runs the text-only clinic ingest, then the
 * evidence-backed concern ingest, and refreshes clinic_search_view.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pool, { query, queryOne } from "../src/lib/db";
import { websiteDomain, findClinicsByDomain } from "../src/lib/admin/clinic-save";
import { fetchHtml, load, normalizeUrl } from "../src/lib/scraper/utils";
import {
  extractServiceAnchors,
  extractServicesFromNav,
} from "../src/lib/scraper/services";
import { discoverConcernPages, discoverContentPages } from "../src/lib/ingest/discover";
import { htmlToText, ingestClinicByDomain } from "../src/lib/ingest/ingest-clinic";
import {
  condenseForConcerns,
  extractClinicConcerns,
} from "../src/lib/ingest/ai-extract-concerns";
import { extractClinicDetails } from "../src/lib/ingest/ai-extract";
import { ingestConcernsByDomain } from "../src/lib/ingest/ingest-concerns";
import { validateConcerns, normText, type ClinicServiceRef } from "../src/lib/ingest/concern-validate";

type StoredService = {
  raw_name: string;
  scraped_from_url: string | null;
  service_name: string | null;
  service_slug: string | null;
  is_published: boolean | null;
  review_status: string | null;
  match_status: string | null;
};

type StoredEvidence = {
  concern_name: string;
  concern_slug: string;
  raw_phrase: string;
  evidence_quote: string;
  source_url: string;
  paired_treatments: string[];
  paired_service_ids: string[];
};

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function tokenCost(usage: { input_tokens: number; output_tokens: number }): string {
  // Conservative default for gpt-4o-mini-era pricing. The report still prints
  // raw tokens, which are the source of truth if model pricing changes.
  const input = usage.input_tokens * 0.00000015;
  const output = usage.output_tokens * 0.0000006;
  return `$${(input + output).toFixed(5)}`;
}

async function fetchTextPage(url: string, concern = false) {
  const r = await fetchHtml(url);
  if (!r) return null;
  const text = htmlToText(load(r.html));
  return { url: r.finalUrl || url, text: concern ? condenseForConcerns(text) : text };
}

async function main() {
  const domainArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!domainArg) {
    console.error("usage: bun --env-file=.env scripts/audit-ingest.ts <domain> [--ai-dry-run] [--repair]");
    process.exit(1);
  }
  if ((argFlag("--ai-dry-run") || argFlag("--repair")) && process.env.OPENAI_API_KEY) {
    process.env.INGEST_PROVIDER = process.env.INGEST_PROVIDER || "openai";
    if (process.env.INGEST_PROVIDER === "gemini") process.env.INGEST_PROVIDER = "openai";
  }

  const repair = argFlag("--repair");
  const aiDryRun = argFlag("--ai-dry-run") || repair;
  const domain = websiteDomain(domainArg);
  const startUrl = normalizeUrl(domainArg);
  const home = await fetchHtml(startUrl);
  if (!home) throw new Error(`homepage unreachable: ${startUrl}`);

  const $home = load(home.html);
  const finalUrl = home.finalUrl || startUrl;
  const navServices = [
    ...extractServicesFromNav($home, finalUrl),
    ...extractServiceAnchors($home, finalUrl),
  ];
  const serviceCandidates = [
    ...new Map(
      navServices
        .filter((s) => s.name?.trim())
        .map((s) => [
          s.name.trim().toLowerCase(),
          {
            name: s.name.trim(),
            category: s.category ?? null,
            url: s.scraped_from_url ?? null,
          },
        ])
    ).values(),
  ];

  const clinicIds = await findClinicsByDomain(domain);
  const clinicId = clinicIds[0] ?? null;
  const clinic = clinicId
    ? await queryOne<{ slug: string; name: string; website: string | null }>(
        `SELECT slug, name, website FROM clinics WHERE id = $1`,
        [clinicId]
      )
    : null;

  const storedServices = clinicId
    ? await query<StoredService>(
        `SELECT cs.raw_name, cs.scraped_from_url, s.name AS service_name, s.slug AS service_slug,
                s.is_published, s.review_status, cs.match_status
           FROM clinic_services cs
           LEFT JOIN services s ON s.id = cs.service_id
          WHERE cs.clinic_id = $1 AND cs.is_active = true
          ORDER BY cs.raw_name`,
        [clinicId]
      )
    : [];

  const storedEvidence = clinicId
    ? await query<StoredEvidence>(
        `SELECT c.name AS concern_name, c.slug AS concern_slug, ev.raw_phrase,
                ev.evidence_quote, ev.source_url, ev.paired_treatments, ev.paired_service_ids
           FROM clinic_concern_evidence ev
           JOIN concerns c ON c.id = ev.concern_id
          WHERE ev.clinic_id = $1
          ORDER BY c.name, ev.source_url`,
        [clinicId]
      )
    : [];

  const pageCache = new Map<string, string | null>();
  async function pageText(url: string): Promise<string | null> {
    const key = url.trim().replace(/\/+$/, "").toLowerCase();
    if (pageCache.has(key)) return pageCache.get(key) ?? null;
    const p = await fetchTextPage(url);
    const text = p ? normText(p.text) : null;
    pageCache.set(key, text);
    return text;
  }

  const evidenceAudit = [];
  for (const ev of storedEvidence) {
    const text = await pageText(ev.source_url);
    const quoteFound = !!text && text.includes(normText(ev.evidence_quote));
    evidenceAudit.push({
      concern: ev.concern_name,
      raw_phrase: ev.raw_phrase,
      source_url: ev.source_url,
      quote_found: quoteFound,
      paired_treatments: ev.paired_treatments,
      paired_service_ids: ev.paired_service_ids,
    });
  }

  const report: Record<string, unknown> = {
    domain,
    provider: process.env.INGEST_PROVIDER || "anthropic",
    model: process.env.OPENAI_MODEL || process.env.INGEST_MODEL || process.env.GEMINI_MODEL || null,
    clinic: clinic ? { id: clinicId, ...clinic } : null,
    live_service_candidates: serviceCandidates,
    stored_services: storedServices,
    stored_service_summary: {
      total: storedServices.length,
      public_mapped: storedServices.filter(
        (s) =>
          s.service_name &&
          s.is_published !== false &&
          (s.review_status ?? "approved") === "approved"
      ).length,
      unmapped: storedServices.filter((s) => !s.service_name).length,
      raw_cosmetic_dentistry: storedServices.some((s) =>
        /cosmetic dentistry/i.test(s.raw_name)
      ),
      public_ruma_gold: storedServices.some((s) =>
        /ruma gold/i.test(s.service_name ?? "")
      ),
    },
    stored_evidence_summary: {
      total: storedEvidence.length,
      quote_found: evidenceAudit.filter((e) => e.quote_found).length,
      quote_missing: evidenceAudit.filter((e) => !e.quote_found).length,
    },
    evidence_audit: evidenceAudit,
  };

  if (aiDryRun) {
    const contentPages = await discoverContentPages($home, finalUrl);
    const pages = [{ url: finalUrl, text: htmlToText($home) }];
    for (const u of contentPages) {
      const p = await fetchTextPage(u);
      if (p) pages.push(p);
    }

    const knownTreatments = (
      await query<{ name: string }>(
        `SELECT name FROM services
          WHERE is_active = true
            AND COALESCE(is_published, true) = true
            AND COALESCE(review_status, 'approved') = 'approved'
          ORDER BY name`
      )
    ).map((r) => r.name);

    const serviceOut = await extractClinicDetails({
      domain,
      pages,
      serviceCandidates,
      knownTreatments,
      useVision: false,
    });
    report.ai_service_dry_run = {
      model: serviceOut.model,
      usage: serviceOut.usage,
      services: serviceOut.data.services,
    };

    if (clinicId) {
      const navUrls = serviceCandidates.map((s) => s.url).filter((u): u is string => !!u);
      const { concernPages, servicePages } = await discoverConcernPages(
        $home,
        finalUrl,
        navUrls,
        { servicePages: Math.min(45, Math.max(12, navUrls.length)) }
      );
      const concernTextPages = [{ url: finalUrl, text: condenseForConcerns(htmlToText($home)) }];
      for (const u of [...concernPages, ...servicePages]) {
        const p = await fetchTextPage(u, true);
        if (p) concernTextPages.push(p);
      }
      const clinicServices = await query<ClinicServiceRef>(
        `SELECT cs.service_id, cs.raw_name, s.name AS canonical_name, cs.scraped_from_url
           FROM clinic_services cs
           JOIN services s ON s.id = cs.service_id
          WHERE cs.clinic_id = $1 AND cs.is_active = true
            AND s.is_active = true
            AND COALESCE(s.is_published, true) = true
            AND COALESCE(s.review_status, 'approved') = 'approved'`,
        [clinicId]
      );
      const concernCatalog = await query<{ name: string; aliases: string[] | null }>(
        `SELECT name, aliases FROM concerns WHERE is_active = true`
      );
      const concernOut = await extractClinicConcerns({
        domain,
        pages: concernTextPages,
        knownConcerns: concernCatalog.map((c) => c.name),
        knownTreatments: [
          ...new Set(clinicServices.map((s) => s.canonical_name ?? s.raw_name)),
        ],
      });
      const validated = validateConcerns(
        concernOut.concerns,
        concernTextPages,
        clinicServices,
        concernCatalog.flatMap((c) => [c.name, ...(c.aliases ?? [])])
      );
      report.ai_concern_dry_run = {
        model: concernOut.model,
        usage: concernOut.usage,
        accepted: validated.accepted,
        rejected: validated.rejected.map((r) => ({
          concern: r.item.general_name,
          raw_phrase: r.item.raw_phrase,
          source_url: r.item.source_url,
          reason: r.reason,
        })),
      };
    }
  }

  if (repair) {
    const clinicRepair = await ingestClinicByDomain(domain, { useVision: false });
    const concernRepair = await ingestConcernsByDomain(domain);
    await query("REFRESH MATERIALIZED VIEW public.clinic_search_view");
    report.repair = {
      clinic: clinicRepair,
      concerns: {
        ...concernRepair,
        rejected: concernRepair.rejected.map((r) => ({
          concern: r.item.general_name,
          raw_phrase: r.item.raw_phrase,
          source_url: r.item.source_url,
          reason: r.reason,
        })),
      },
      search_view_refreshed: true,
    };
  }

  const outDir = path.join(process.cwd(), "reports");
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `ingest-audit-${domain.replace(/[^a-z0-9]+/gi, "-")}-${Date.now()}.json`);
  await writeFile(file, JSON.stringify(report, null, 2));

  const svc = report.ai_service_dry_run as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined;
  const con = report.ai_concern_dry_run as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined;
  const usage = {
    input_tokens: (svc?.usage?.input_tokens ?? 0) + (con?.usage?.input_tokens ?? 0),
    output_tokens: (svc?.usage?.output_tokens ?? 0) + (con?.usage?.output_tokens ?? 0),
  };

  console.log(`Report: ${file}`);
  console.log(`Clinic: ${clinic?.name ?? "not found"} (${clinic?.slug ?? "-"})`);
  console.log(`Live service candidates: ${serviceCandidates.length}`);
  console.log(`Stored services: ${storedServices.length}`);
  console.log(`Stored evidence quote found: ${report.stored_evidence_summary && (report.stored_evidence_summary as { quote_found: number }).quote_found}/${storedEvidence.length}`);
  if (aiDryRun) {
    console.log(`AI dry-run tokens: in=${usage.input_tokens} out=${usage.output_tokens} estimated=${tokenCost(usage)}`);
  }
  if (repair) console.log("Repair: complete; clinic_search_view refreshed");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.stack || err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
