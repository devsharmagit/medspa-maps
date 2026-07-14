import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { importWebsiteWithAi } from "@/lib/admin/website-import";

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
 *   2. G99 match — attach harvested clinic/business/tenant ids when available.
 *   3. Ingest clinic DETAILS — creates business + clinic rows.
 *   4. Run the unified treatment+concern AI extraction and save associations.
 *   5. Refresh the search matview.
 *
 * Returns (all HTTP 200, discriminated on `outcome`):
 *   { outcome: "blocked",  domain, duplicate: ExistingClinicRef[] }
 *   { outcome: "ingested", domain, result, treatmentsConcerns, g99 }
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { url } = schema.parse(await req.json());
    return successResponse(await importWebsiteWithAi(url));
  } catch (err) {
    return handleApiError(err);
  }
}
