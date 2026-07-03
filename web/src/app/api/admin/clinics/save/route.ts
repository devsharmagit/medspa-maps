import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { query } from "@/lib/db";
import {
  saveClinicBundle,
  websiteDomain,
  findClinicsByDomain,
  type ClinicBundle,
} from "@/lib/admin/clinic-save";

// Payload is assembled by the admin UI from the scrape-preview output. We keep
// validation light (the heavy lifting lives in saveClinicBundle); we just
// guarantee the dedup key (website) and a non-empty business name exist.
const saveSchema = z.object({
  payload: z
    .object({
      website: z.string().min(1, "website is required"),
      business: z.object({ name: z.string().min(1, "business name is required") }),
    })
    .passthrough(),
});

interface ExistingClinic {
  id: string;
  name: string;
  slug: string;
  website: string | null;
}

// POST /api/admin/clinics/save
// Persist a save-ready clinic bundle. When a clinic already exists for the
// website domain and overwrite !== true, returns 409 with the existing clinic
// info so the UI can warn before overwriting.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { payload } = saveSchema.parse(body);
    const bundle = payload as unknown as ClinicBundle;

    // ── hard duplicate block ─────────────────────────────────────────────────
    // The add flow NEVER overwrites. If a clinic already exists for this website
    // domain, return 409 with the existing rows so the UI can send the admin to
    // edit or delete it instead of silently replacing it.
    const domain = websiteDomain(bundle.website);
    const existingIds = await findClinicsByDomain(domain);

    if (existingIds.length > 0) {
      const existing = await query<ExistingClinic>(
        `SELECT id, name, slug, website FROM clinics WHERE id = ANY($1::uuid[])`,
        [existingIds]
      );
      // errorResponse() only carries a message; we ship the existing clinic
      // rows alongside the 409 so the UI can link to edit/view, hence a custom body.
      return buildConflict(domain, existing);
    }

    // ── save (create-only) ───────────────────────────────────────────────────
    const result = await saveClinicBundle(bundle, { overwrite: false });

    // ── refresh the public materialized view (best-effort) ────────────────────
    try {
      await query("REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view");
    } catch (err) {
      console.error("[clinics/save] clinic_search_view refresh failed", err);
    }

    return successResponse(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

function buildConflict(domain: string, existing: ExistingClinic[]) {
  return Response.json(
    {
      success: false,
      data: null,
      error: `A clinic already exists for ${domain}. Edit or delete the existing clinic instead of adding it again.`,
      duplicate: { exists: true, byDomain: domain, clinics: existing },
    },
    { status: 409 }
  );
}
