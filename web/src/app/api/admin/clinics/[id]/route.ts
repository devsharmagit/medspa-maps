import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query, queryOne, withTransaction } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";

// Editable clinic columns. Pricing + provider fields are intentionally excluded.
const patchSchema = z
  .object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(255),
    tagline: z.string().nullable(),
    about: z.string().nullable(),
    // Accept a valid URL or an empty string (cleared field) — no hard 422.
    // An empty website is dropped server-side (the column is NOT NULL).
    website: z.union([z.url("Must be a valid URL"), z.literal("")]),
    booking_url: z.union([z.url("Must be a valid URL"), z.literal(""), z.null()]),
    address: z.string().nullable(),
    country: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    hours: z.record(z.string(), z.unknown()).nullable(),
    instagram_url: z.string().nullable(),
    facebook_url: z.string().nullable(),
    tiktok_url: z.string().nullable(),
    youtube_url: z.string().nullable(),
    x_url: z.string().nullable(),
    linkedin_url: z.string().nullable(),
    yelp_url: z.string().nullable(),
    google_my_business: z.string().nullable(),
    google_maps_url: z.union([z.url("Must be a valid URL"), z.literal(""), z.null()]),
    ext_rating: z.number().min(0).max(5).nullable(),
    ext_review_count: z.number().int().min(0).nullable(),
    is_active: z.boolean(),
    featured: z.boolean().optional(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

// JSONB column — must be stringified for the pg driver.
const JSONB_COLS = new Set(["hours"]);

interface ClinicRow {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  about: string | null;
  website: string;
  booking_url: string | null;
  address: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  hours: Record<string, unknown> | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  linkedin_url: string | null;
  yelp_url: string | null;
  google_my_business: string | null;
  google_maps_url: string | null;
  google_place_id: string | null;
  avg_rating: string | null;
  review_count: number;
  ext_rating: string | null;
  ext_review_count: number | null;
  featured: boolean;
  data_source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ImageRef {
  id: string;
  source_url: string;
  cdn_url: string | null;
  role: string;
  sort_order: number;
  alt_text: string | null;
}

interface LocationRef {
  id: string;
  label: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  lat: string | null;
  lng: string | null;
  phone: string | null;
  email: string | null;
  booking_url: string | null;
  google_maps_url: string | null;
  hours: Record<string, unknown> | null;
  is_primary: boolean;
  sort_order: number;
}

interface TreatmentRef {
  id: string;
  service_id: string | null;
  service_slug: string | null;
  service_name: string | null;
  raw_name: string;
  description: string | null;
  match_status: string | null;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

const CLINIC_COLS = `id, name, slug, tagline, about, website, booking_url,
  address, country, phone, email, hours,
  instagram_url, facebook_url, tiktok_url, youtube_url, x_url, linkedin_url,
  yelp_url, google_my_business, google_maps_url, google_place_id, avg_rating, review_count,
  ext_rating, ext_review_count, featured,
  data_source, is_active, created_at, updated_at`;

// GET /api/admin/clinics/[id] — full editable record + images + treatments offered
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;

    const clinic = await queryOne<ClinicRow>(
      `SELECT ${CLINIC_COLS} FROM clinics WHERE id = $1`,
      [id]
    );

    if (!clinic) throw ApiError.notFound("Clinic not found");

    const images = await query<ImageRef>(
      `SELECT id, source_url, cdn_url, role, sort_order, alt_text
         FROM images
        WHERE entity_type = 'clinic' AND entity_id = $1
        ORDER BY CASE role WHEN 'logo' THEN 0 WHEN 'cover' THEN 1 WHEN 'gallery' THEN 2 ELSE 3 END, sort_order`,
      [id]
    );

    const treatments = await query<TreatmentRef>(
      `SELECT cs.id, cs.service_id, s.slug AS service_slug, s.name AS service_name,
              cs.raw_name, cs.description, cs.match_status
         FROM clinic_services cs
         LEFT JOIN services s ON s.id = cs.service_id
        WHERE cs.clinic_id = $1 AND cs.is_active = true
        ORDER BY COALESCE(s.name, cs.raw_name)`,
      [id]
    );

    const locations = await query<LocationRef>(
      `SELECT id, label, address, city, state, zip, country,
              lat::text, lng::text, phone, email,
              booking_url, google_maps_url, hours, is_primary, sort_order
         FROM clinic_locations
        WHERE clinic_id = $1 AND is_active = true
        ORDER BY sort_order, created_at`,
      [id]
    );

    return successResponse({
      ...clinic,
      images,
      treatments,
      locations,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/admin/clinics/[id] — update editable fields
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const fields = patchSchema.parse(body);

    const cols: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, rawValue] of Object.entries(fields)) {
      // website is NOT NULL — an empty value means "leave unchanged", not blank.
      if (key === "website" && (rawValue === "" || rawValue == null)) continue;
      // Treat empty strings on optional URL/text fields as NULL.
      const value = rawValue === "" ? null : rawValue;
      if (JSONB_COLS.has(key)) {
        cols.push(`${key} = $${i++}::jsonb`);
        values.push(value === null ? null : JSON.stringify(value));
      } else {
        cols.push(`${key} = $${i++}`);
        values.push(value);
      }
    }

    // Nothing left to update (e.g. only an empty website was sent).
    if (cols.length === 0) {
      const current = await queryOne<ClinicRow>(
        `SELECT ${CLINIC_COLS} FROM clinics WHERE id = $1`,
        [id]
      );
      if (!current) throw ApiError.notFound("Clinic not found");
      return successResponse(current);
    }

    values.push(id);

    const updated = await queryOne<ClinicRow>(
      `UPDATE clinics SET ${cols.join(", ")}, updated_at = NOW()
        WHERE id = $${i} RETURNING ${CLINIC_COLS}`,
      values
    );

    if (!updated) throw ApiError.notFound("Clinic not found");

    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/admin/clinics/[id] — permanent delete.
// Child rows (locations, services, providers, reviews, concerns) are removed by
// ON DELETE CASCADE; polymorphic images have no FK so we clean them up
// explicitly, all inside one transaction.
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;

    const deleted = await withTransaction(async (client) => {
      await client.query(
        "DELETE FROM images WHERE entity_type = 'clinic' AND entity_id = $1",
        [id]
      );
      const res = await client.query<{ id: string; name: string }>(
        "DELETE FROM clinics WHERE id = $1 RETURNING id, name",
        [id]
      );
      return res.rows[0] ?? null;
    });

    if (!deleted) throw ApiError.notFound("Clinic not found");

    return successResponse({ id: deleted.id, name: deleted.name });
  } catch (err) {
    return handleApiError(err);
  }
}
