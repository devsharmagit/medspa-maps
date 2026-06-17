import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { query, queryOne } from "@/lib/db";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function slugify(val: string): string {
  return val
    .toLowerCase()
    .replace(/[®™©°]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(businessId: string, base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let n = 2;
  while (true) {
    const conflict = await queryOne(
      `SELECT id FROM clinics WHERE business_id = $1 AND slug = $2${excludeId ? " AND id != $3" : ""}`,
      excludeId ? [businessId, slug, excludeId] : [businessId, slug]
    );
    if (!conflict) return slug;
    slug = `${base}-${n++}`;
  }
}

interface G99Clinic {
  clinic_id: number;
  clinic_name: string;
  clinic_address: string | null;
  clinic_city: string | null;
  clinic_state: string | null;
  clinic_country: string | null;
  clinic_contact_number: string | null;
  clinic_website: string | null;
  clinic_about: string | null;
  google_my_business: string | null;
  google_place_id: string | null;
  google_profile_id: string | null;
}

export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  let body: { ourBusinessId: string; g99Clinic: G99Clinic };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { ourBusinessId, g99Clinic } = body;
  if (!ourBusinessId || !g99Clinic?.clinic_id || !g99Clinic?.clinic_name) {
    return errorResponse("Missing required fields", 400);
  }

  try {
    // Check if this G99 clinic already exists
    const existing = await queryOne<{ id: string; slug: string }>(
      "SELECT id, slug FROM clinics WHERE g99_clinic_id = $1",
      [g99Clinic.clinic_id]
    );

    if (existing) {
      // Update in-place — keep same slug to avoid breaking URLs
      await query(
        `UPDATE clinics SET
           name                = $1,
           address             = $2,
           city                = $3,
           state               = $4,
           country             = COALESCE($5, 'US'),
           phone               = $6,
           website             = COALESCE($7, website),
           about               = $8,
           google_my_business  = $9,
           google_place_id     = $10,
           last_synced_at      = NOW(),
           is_active           = true,
           updated_at          = NOW()
         WHERE id = $11`,
        [
          g99Clinic.clinic_name,
          g99Clinic.clinic_address,
          g99Clinic.clinic_city,
          g99Clinic.clinic_state,
          g99Clinic.clinic_country,
          g99Clinic.clinic_contact_number,
          g99Clinic.clinic_website,
          g99Clinic.clinic_about,
          g99Clinic.google_my_business,
          g99Clinic.google_place_id,
          existing.id,
        ]
      );
      return successResponse({ our_clinic_id: existing.id });
    }

    // New clinic — generate a unique slug
    const baseSlug = slugify(g99Clinic.clinic_name) || "clinic";
    const slug = await uniqueSlug(ourBusinessId, baseSlug);

    const row = await queryOne<{ id: string }>(
      `INSERT INTO clinics
         (business_id, name, slug, website, address, city, state, country,
          phone, about, google_my_business, google_place_id,
          data_source, g99_clinic_id, last_synced_at, is_active)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'US'),
          $9, $10, $11, $12,
          'g99', $13, NOW(), true)
       RETURNING id`,
      [
        ourBusinessId,
        g99Clinic.clinic_name,
        slug,
        g99Clinic.clinic_website ?? "",
        g99Clinic.clinic_address,
        g99Clinic.clinic_city,
        g99Clinic.clinic_state,
        g99Clinic.clinic_country,
        g99Clinic.clinic_contact_number,
        g99Clinic.clinic_about,
        g99Clinic.google_my_business,
        g99Clinic.google_place_id,
        g99Clinic.clinic_id,
      ]
    );

    if (!row) throw new Error("Insert returned no row");
    return successResponse({ our_clinic_id: row.id });
  } catch (err) {
    return handleApiError(err);
  }
}
