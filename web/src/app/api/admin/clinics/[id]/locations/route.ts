import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query, queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";

const locationSchema = z.object({
  label: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  google_maps_url: z.union([z.url(), z.literal(""), z.null()]).optional(),
  hours: z.record(z.string(), z.unknown()).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  is_primary: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/admin/clinics/[id]/locations
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;

    const rows = await query(
      `SELECT id, label, address, city, state, zip, country, lat::text, lng::text,
              phone, email, google_maps_url, hours, is_primary, sort_order
         FROM clinic_locations
        WHERE clinic_id = $1 AND is_active = true
        ORDER BY sort_order, created_at`,
      [id]
    );

    return successResponse(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/admin/clinics/[id]/locations — add a new location
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id: clinicId } = await params;

    const clinic = await queryOne<{ id: string }>(
      `SELECT id FROM clinics WHERE id = $1`,
      [clinicId]
    );
    if (!clinic) throw ApiError.notFound("Clinic not found");

    const body = await req.json();
    const data = locationSchema.parse(body);

    // Determine next sort_order
    const maxOrder = await queryOne<{ max: number }>(
      `SELECT COALESCE(MAX(sort_order), -1) AS max FROM clinic_locations WHERE clinic_id = $1`,
      [clinicId]
    );
    const sortOrder = (maxOrder?.max ?? -1) + 1;

    const isPrimary = data.is_primary ?? sortOrder === 0;

    // If this is marked primary, demote any existing primary
    if (isPrimary) {
      await query(
        `UPDATE clinic_locations SET is_primary = false WHERE clinic_id = $1`,
        [clinicId]
      );
    }

    const hoursJson =
      data.hours !== undefined && data.hours !== null
        ? JSON.stringify(data.hours)
        : null;

    const row = await queryOne(
      `INSERT INTO clinic_locations
         (clinic_id, label, address, city, state, zip, country, phone, email,
          google_maps_url, hours, lat, lng, is_primary, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)
       RETURNING id, label, address, city, state, zip, country, lat::text, lng::text,
                 phone, email, google_maps_url, hours, is_primary, sort_order`,
      [
        clinicId,
        data.label ?? null,
        data.address ?? null,
        data.city ?? null,
        data.state ?? null,
        data.zip ?? null,
        data.country || "US",
        data.phone ?? null,
        data.email ?? null,
        data.google_maps_url || null,
        hoursJson,
        data.lat ?? null,
        data.lng ?? null,
        isPrimary,
        sortOrder,
      ]
    );

    // Sync primary location fields back to clinics table
    if (isPrimary) {
      await syncPrimaryToClinics(clinicId);
    }

    return successResponse(row, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

// Sync primary location fields up to the clinics row for search compat.
// NOTE: `clinics` no longer has city/state/zip/lat/lng/geo (schema
// simplification) — those live only on `clinic_locations`. Only sync columns
// that still exist on `clinics`, or this throws 42703.
async function syncPrimaryToClinics(clinicId: string) {
  const primary = await queryOne<{
    address: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    google_maps_url: string | null;
  }>(
    `SELECT address, country, phone, email, google_maps_url
       FROM clinic_locations
      WHERE clinic_id = $1 AND is_primary = true AND is_active = true
      ORDER BY sort_order LIMIT 1`,
    [clinicId]
  );
  if (!primary) return;

  // NOTE: hours now live ONLY on clinic_locations and booking_url ONLY on
  // clinics, so neither is synced here anymore.
  await query(
    `UPDATE clinics SET
        address = $2, country = COALESCE($3, country),
        phone = COALESCE($4, phone),
        email = COALESCE($5, email),
        google_maps_url = COALESCE($6, google_maps_url),
        updated_at = NOW()
      WHERE id = $1`,
    [
      clinicId,
      primary.address, primary.country,
      primary.phone, primary.email, primary.google_maps_url,
    ]
  );
}
