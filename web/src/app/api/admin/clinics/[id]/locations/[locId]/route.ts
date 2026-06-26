import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query, queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";

const patchSchema = z
  .object({
    label: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    zip: z.string().nullable(),
    country: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    booking_url: z.union([z.url(), z.literal(""), z.null()]),
    google_maps_url: z.union([z.url(), z.literal(""), z.null()]),
    hours: z.record(z.string(), z.unknown()).nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    is_primary: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

interface RouteContext {
  params: Promise<{ id: string; locId: string }>;
}

// PATCH /api/admin/clinics/[id]/locations/[locId]
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id: clinicId, locId } = await params;

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM clinic_locations WHERE id = $1 AND clinic_id = $2`,
      [locId, clinicId]
    );
    if (!existing) throw ApiError.notFound("Location not found");

    const body = await req.json();
    const fields = patchSchema.parse(body);

    // If promoting to primary, demote others first
    if (fields.is_primary) {
      await query(
        `UPDATE clinic_locations SET is_primary = false WHERE clinic_id = $1 AND id != $2`,
        [clinicId, locId]
      );
    }

    const cols: string[] = [];
    const values: unknown[] = [locId];
    let i = 2;

    for (const [key, rawValue] of Object.entries(fields)) {
      const value = rawValue === "" ? null : rawValue;
      if (key === "hours") {
        cols.push(`hours = $${i++}::jsonb`);
        values.push(value === null ? null : JSON.stringify(value));
      } else {
        cols.push(`${key} = $${i++}`);
        values.push(value);
      }
    }

    const updated = await queryOne(
      `UPDATE clinic_locations SET ${cols.join(", ")}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, label, address, city, state, zip, country, lat::text, lng::text,
                  phone, email, booking_url, google_maps_url, hours, is_primary, sort_order`,
      values
    );

    if (!updated) throw ApiError.notFound("Location not found");

    // Keep clinics table in sync if this is the primary location
    const isPrimary = await queryOne<{ is_primary: boolean }>(
      `SELECT is_primary FROM clinic_locations WHERE id = $1`,
      [locId]
    );
    if (isPrimary?.is_primary) {
      await syncPrimaryToClinics(clinicId);
    }

    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/admin/clinics/[id]/locations/[locId]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id: clinicId, locId } = await params;

    // Count active locations — must keep at least one
    const count = await queryOne<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM clinic_locations WHERE clinic_id = $1 AND is_active = true`,
      [clinicId]
    );
    if ((count?.n ?? 0) <= 1) {
      throw ApiError.badRequest("Cannot remove the last location of a clinic");
    }

    const row = await queryOne<{ id: string; is_primary: boolean }>(
      `UPDATE clinic_locations SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND clinic_id = $2
        RETURNING id, is_primary`,
      [locId, clinicId]
    );
    if (!row) throw ApiError.notFound("Location not found");

    // If we just removed the primary, promote the next one
    if (row.is_primary) {
      await query(
        `UPDATE clinic_locations SET is_primary = true
          WHERE clinic_id = $1 AND is_active = true
            AND id = (
              SELECT id FROM clinic_locations
              WHERE clinic_id = $1 AND is_active = true
              ORDER BY sort_order, created_at LIMIT 1
            )`,
        [clinicId]
      );
      await syncPrimaryToClinics(clinicId);
    }

    return successResponse({ id: locId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}

async function syncPrimaryToClinics(clinicId: string) {
  const primary = await queryOne<{
    address: string | null; city: string | null; state: string | null;
    zip: string | null; country: string | null; lat: string | null; lng: string | null;
    phone: string | null; email: string | null;
    booking_url: string | null; google_maps_url: string | null; hours: unknown;
  }>(
    `SELECT address, city, state, zip, country, lat::text, lng::text, phone, email,
            booking_url, google_maps_url, hours
       FROM clinic_locations
      WHERE clinic_id = $1 AND is_primary = true AND is_active = true
      ORDER BY sort_order LIMIT 1`,
    [clinicId]
  );
  if (!primary) return;

  await query(
    `UPDATE clinics SET address=$2, city=$3, state=$4, zip=$5, country=$6,
        phone=COALESCE($7,phone), email=COALESCE($8,email),
        booking_url=COALESCE($9,booking_url),
        google_maps_url=COALESCE($10,google_maps_url),
        hours=$11::jsonb, updated_at=NOW()
      WHERE id=$1`,
    [clinicId, primary.address, primary.city, primary.state, primary.zip,
     primary.country ?? "US", primary.phone, primary.email,
     primary.booking_url, primary.google_maps_url,
     primary.hours == null ? null : JSON.stringify(primary.hours)]
  );

  if (primary.lat && primary.lng) {
    const lat = parseFloat(primary.lat);
    const lng = parseFloat(primary.lng);
    try {
      await query(
        `UPDATE clinics SET lat=$2::numeric, lng=$3::numeric,
            geo=ST_SetSRID(ST_MakePoint($3::float8,$2::float8),4326)::geography
          WHERE id=$1`,
        [clinicId, lat, lng]
      );
    } catch {
      await query(`UPDATE clinics SET lat=$2::numeric, lng=$3::numeric WHERE id=$1`, [clinicId, lat, lng]);
    }
  }
}
