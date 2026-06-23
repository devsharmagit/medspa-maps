import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query, queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";

// Editable clinic columns. Pricing + provider fields are intentionally excluded.
const patchSchema = z
  .object({
    name: z.string().min(1).max(255),
    tagline: z.string().nullable(),
    about: z.string().nullable(),
    // Accept a valid URL or an empty string (cleared field) — no hard 422.
    // An empty website is dropped server-side (the column is NOT NULL).
    website: z.union([z.url("Must be a valid URL"), z.literal("")]),
    booking_url: z.union([z.url("Must be a valid URL"), z.literal(""), z.null()]),
    address: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zip: z.string().nullable(),
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
    founded_year: z.number().int().nullable(),
    is_active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

// JSONB column — must be stringified for the pg driver.
const JSONB_COLS = new Set(["hours"]);

interface ClinicRow {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  about: string | null;
  website: string;
  booking_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  lat: string | null;
  lng: string | null;
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
  founded_year: number | null;
  tier: string;
  verified: boolean;
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

interface TreatmentRef {
  id: string;
  service_id: string | null;
  raw_name: string;
  description: string | null;
  match_status: string | null;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

const CLINIC_COLS = `id, business_id, name, slug, tagline, about, website, booking_url,
  address, city, state, zip, country, lat, lng, phone, email, hours,
  instagram_url, facebook_url, tiktok_url, youtube_url, x_url, linkedin_url,
  yelp_url, google_my_business, google_maps_url, google_place_id, avg_rating, review_count,
  ext_rating, ext_review_count, founded_year, tier, verified, featured,
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
        ORDER BY role, sort_order`,
      [id]
    );

    const treatments = await query<TreatmentRef>(
      `SELECT id, service_id, raw_name, description, match_status
         FROM clinic_services
        WHERE clinic_id = $1 AND is_active = true
        ORDER BY raw_name`,
      [id]
    );

    return successResponse({ ...clinic, images, treatments });
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

// DELETE /api/admin/clinics/[id] — soft delete (is_active = false)
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;

    const deleted = await queryOne<{ id: string; name: string }>(
      "UPDATE clinics SET is_active = false WHERE id = $1 RETURNING id, name",
      [id]
    );

    if (!deleted) throw ApiError.notFound("Clinic not found");

    return successResponse({ id: deleted.id, name: deleted.name });
  } catch (err) {
    return handleApiError(err);
  }
}
