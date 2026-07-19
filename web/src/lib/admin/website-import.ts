import { query } from "@/lib/db";
import { findExistingClinicsByDomain, websiteDomain } from "@/lib/admin/clinic-save";
import type { ExistingClinicRef } from "@/lib/admin/clinic-save";
import { lookupG99ByDomain, type G99Attach } from "@/lib/g99/harvest";
import { ingestClinicByDomain, type IngestResult } from "@/lib/ingest/ingest-clinic";
import {
  ingestTreatmentsAndConcernsByDomain,
  type TreatmentsConcernsResult,
} from "@/lib/ingest/ingest-treatments-concerns";
import { ApiError } from "@/lib/errors";

export type AdminWebsiteImportResponse =
  | { outcome: "blocked"; domain: string; duplicate: ExistingClinicRef[] }
  | {
      outcome: "ingested";
      domain: string;
      result: IngestResult;
      treatmentsConcerns: TreatmentsConcernsResult;
      g99: G99Attach | null;
    };

function importLog(domain: string, stage: string, data?: Record<string, unknown>): void {
  console.info(`[website-import] ${domain} ${stage}`, {
    at: new Date().toISOString(),
    ...(data ?? {}),
  });
}

async function cleanupNewPartialClinic(clinicId?: string | null): Promise<void> {
  if (!clinicId) return;
  // Deleting the clinic cascades to its child rows (locations/services/etc.).
  await query(`DELETE FROM clinics WHERE id = $1`, [clinicId]);
}

export async function importWebsiteWithAi(url: string): Promise<AdminWebsiteImportResponse> {
  const domain = websiteDomain(url);
  if (!domain) throw ApiError.badRequest("Could not parse a domain from that URL.");

  const started = Date.now();
  importLog(domain, "start", { url });

  const existing = await findExistingClinicsByDomain(domain);
  if (existing.length > 0) {
    importLog(domain, "blocked-duplicate", { count: existing.length });
    return { outcome: "blocked", domain, duplicate: existing };
  }

  const g99 = await lookupG99ByDomain(domain);
  importLog(domain, "details-start", {
    g99ClinicId: g99?.g99_clinic_id ?? null,
    g99BusinessId: g99?.g99_business_id ?? null,
  });
  const result = await ingestClinicByDomain(url, {
    g99: g99
      ? {
          g99_clinic_id: g99.g99_clinic_id,
          g99_business_id: g99.g99_business_id,
          g99_tenant_id: g99.g99_tenant_id,
        }
      : undefined,
  });
  importLog(domain, "details-done", {
    status: result.status,
    clinicId: result.clinicId ?? null,
    slug: result.slug ?? null,
    locations: result.locations,
    images: result.images,
    providers: result.providers ?? 0,
    beforeAfter: result.beforeAfter ?? 0,
    ms: Date.now() - started,
  });

  let treatmentsConcerns: TreatmentsConcernsResult;
  try {
    importLog(domain, "treatments-concerns-start", {
      clinicId: result.clinicId ?? null,
      ms: Date.now() - started,
    });
    treatmentsConcerns =
      result.status === "saved"
        ? await ingestTreatmentsAndConcernsByDomain(url)
        : {
            domain,
            status: "skipped" as const,
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
            note: "clinic details not saved",
          };
    importLog(domain, "treatments-concerns-done", {
      status: treatmentsConcerns.status,
      pages: treatmentsConcerns.pagesFetched,
      treatments: treatmentsConcerns.treatmentsFound,
      concerns: treatmentsConcerns.concernsSaved,
      mappings: treatmentsConcerns.mappingsSaved,
      model: treatmentsConcerns.modelUsed,
      ms: Date.now() - started,
    });
  } catch (err) {
    importLog(domain, "treatments-concerns-failed", {
      clinicId: result.clinicId ?? null,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    });
    if (result.status === "saved") {
      await cleanupNewPartialClinic(result.clinicId);
      importLog(domain, "partial-cleaned", { clinicId: result.clinicId ?? null });
    }
    throw err;
  }

  if (result.status === "saved") {
    importLog(domain, "search-refresh-start", { ms: Date.now() - started });
    await query("REFRESH MATERIALIZED VIEW public.clinic_search_view");
    importLog(domain, "search-refresh-done", { ms: Date.now() - started });
  }

  importLog(domain, "done", { ms: Date.now() - started });
  return { outcome: "ingested", domain, result, treatmentsConcerns, g99 };
}
