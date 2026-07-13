import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";
import { websiteDomain, findExistingClinicsByDomain } from "@/lib/admin/clinic-save";
import { lookupG99ByDomain } from "@/lib/g99/harvest";
import { ingestClinicByDomain } from "@/lib/ingest/ingest-clinic";

// The full AI ingest (multi-page fetch + AI extraction + geocode) takes 30-90s,
// so lift the default route timeout and run on the Node runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({ url: z.string().min(1, "url is required") });

/**
 * POST /api/admin/clinics/ingest  { url }
 *
 * "Add website with AI": runs the full weburltodataindb pipeline for one site.
 *   1. Dedup — if the domain is already a clinic, BLOCK (don't overwrite).
 *   2. G99 match — if the domain is in the harvested g99_clinic_websites list,
 *      attach its clinic/business/tenant ids so the saved rows carry the hard link.
 *   3. Ingest (ingestClinicByDomain) → refresh the search matview.
 *
 * Returns (all HTTP 200, discriminated on `outcome`):
 *   { outcome: "blocked",  domain, duplicate: ExistingClinicRef[] }
 *   { outcome: "ingested", domain, result: IngestResult, g99: G99Attach | null }
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { url } = schema.parse(await req.json());

    const domain = websiteDomain(url);
    if (!domain) throw ApiError.badRequest("Could not parse a domain from that URL.");

    // 1. Dedup — block before doing the expensive scrape.
    const existing = await findExistingClinicsByDomain(domain);
    if (existing.length > 0) {
      return successResponse({ outcome: "blocked" as const, domain, duplicate: existing });
    }

    // 2. G99 harvest match (optional provenance).
    const g99 = await lookupG99ByDomain(domain);

    // 3. Full AI ingest, stamping G99 ids when matched.
    const result = await ingestClinicByDomain(url, {
      g99: g99
        ? {
            g99_clinic_id: g99.g99_clinic_id,
            g99_business_id: g99.g99_business_id,
            g99_tenant_id: g99.g99_tenant_id,
          }
        : undefined,
    });

    // 4. Refresh the search index so the new clinic is findable.
    if (result.status === "saved") {
      await query("REFRESH MATERIALIZED VIEW public.clinic_search_view");
    }

    return successResponse({ outcome: "ingested" as const, domain, result, g99 });
  } catch (err) {
    return handleApiError(err);
  }
}
