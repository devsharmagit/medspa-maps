import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { query, queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { websiteDomain } from "@/lib/admin/clinic-save";
import { importWebsiteWithAi } from "@/lib/admin/website-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// One row per unique medspa website (table public.g99_clinic_websites).
// bigint[] columns come back as string[].
export interface G99WebsiteRow {
  domain: string;
  website: string;
  clinic_count: number;
  business_count: number;
  g99_clinic_ids: string[];
  g99_business_ids: string[];
  business_name: string | null;
  clinic_name: string | null;
  specialization: string | null;
  imported: boolean;
  imported_clinic_id: string | null;
}

const importSchema = z.object({
  domain: z.string().min(1, "domain is required").optional(),
  website: z.string().min(1, "website is required").optional(),
});

// GET /api/admin/g99-websites — the unique medspa websites harvested from G99.
export async function GET() {
  try {
    await requireAdmin();

    const rows = await query<G99WebsiteRow>(
      `SELECT g.domain,
              g.website,
              g.clinic_count,
              g.business_count,
              g.g99_clinic_ids,
              g.g99_business_ids,
              g.business_name,
              g.clinic_name,
              g.specialization,
              (c.id IS NOT NULL) AS imported,
              c.id::text AS imported_clinic_id
         FROM g99_clinic_websites g
         LEFT JOIN LATERAL (
           SELECT id FROM clinics
            WHERE lower(regexp_replace(regexp_replace(website, '^https?://', ''), '^www\\.', ''))
                  LIKE (g.domain || '%')
            LIMIT 1
         ) c ON true
        ORDER BY g.clinic_count DESC, g.domain ASC`
    );

    return successResponse(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/admin/g99-websites { domain | website } — import one harvested site.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = importSchema.parse(await req.json());
    const domain = websiteDomain(body.domain || body.website || "");
    if (!domain) throw ApiError.badRequest("Could not parse a domain to import.");

    const row = await queryOne<{ website: string }>(
      `SELECT website FROM g99_clinic_websites WHERE domain = $1`,
      [domain]
    );
    if (!row) throw ApiError.notFound("No harvested G99 website found for that domain.");

    return successResponse(await importWebsiteWithAi(row.website));
  } catch (err) {
    return handleApiError(err);
  }
}
