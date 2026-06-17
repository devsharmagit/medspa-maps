import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { query, queryOne } from "@/lib/db";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { parseUSAddress, normalizeState } from "@/lib/address-parser";
import { geocodeAddress } from "@/lib/geocoder";

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

// ── Address resolution helpers ──────────────────────────────────────────────

/**
 * Resolves city, state (abbreviation), and zip by combining G99 fields
 * with parsed data from the address string. G99 explicit fields take
 * priority; address parsing is the fallback.
 */
function resolveLocation(g99: G99Clinic): {
  city: string | null;
  state: string | null;
  zip: string | null;
} {
  const parsed = parseUSAddress(g99.clinic_address);

  // State: prefer G99 value (normalized to abbreviation) → parsed
  const state =
    normalizeState(g99.clinic_state) ??
    parsed?.state ??
    null;

  // City: prefer G99 value → parsed
  const city =
    (g99.clinic_city && g99.clinic_city.trim()) || parsed?.city || null;

  // Zip: only from parsing (G99 doesn't provide it)
  const zip = parsed?.zip ?? null;

  return { city, state, zip };
}

// ── Route handler ───────────────────────────────────────────────────────────

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
    // Resolve city / state / zip from G99 fields + address parsing
    const { city, state, zip } = resolveLocation(g99Clinic);

    // Check if this G99 clinic already exists
    const existing = await queryOne<{
      id: string;
      slug: string;
      lat: number | null;
      lng: number | null;
    }>(
      "SELECT id, slug, lat, lng FROM clinics WHERE g99_clinic_id = $1",
      [g99Clinic.clinic_id]
    );

    if (existing) {
      // ── UPDATE existing clinic ──────────────────────────────────────────
      // Geocode only if lat/lng are still missing
      let lat: number | null = existing.lat;
      let lng: number | null = existing.lng;

      if (lat == null || lng == null) {
        const geo = await geocodeAddress(g99Clinic.clinic_address ?? "");
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          console.log(`[upsert-clinic] Geocoded "${g99Clinic.clinic_name}" → ${lat}, ${lng}`);
        }
      }

      await query(
        `UPDATE clinics SET
           name                = $1,
           address             = $2,
           city                = COALESCE($3, city),
           state               = COALESCE($4, state),
           zip                 = COALESCE($5, zip),
           country             = COALESCE($6, 'US'),
           phone               = $7,
           website             = COALESCE($8, website),
           about               = $9,
           google_my_business  = $10,
           google_place_id     = $11,
           lat                 = COALESCE($12, lat),
           lng                 = COALESCE($13, lng),
           geo                 = COALESCE(
             CASE WHEN $12::numeric IS NOT NULL AND $13::numeric IS NOT NULL
               THEN ST_SetSRID(ST_MakePoint($13::float, $12::float), 4326)::geography
             END,
             geo
           ),
           last_synced_at      = NOW(),
           is_active           = true,
           updated_at          = NOW()
         WHERE id = $14`,
        [
          g99Clinic.clinic_name,       // $1
          g99Clinic.clinic_address,     // $2
          city,                         // $3
          state,                        // $4
          zip,                          // $5
          g99Clinic.clinic_country,     // $6
          g99Clinic.clinic_contact_number, // $7
          g99Clinic.clinic_website,     // $8
          g99Clinic.clinic_about,       // $9
          g99Clinic.google_my_business, // $10
          g99Clinic.google_place_id,    // $11
          lat,                          // $12
          lng,                          // $13
          existing.id,                  // $14
        ]
      );
      return successResponse({ our_clinic_id: existing.id });
    }

    // ── INSERT new clinic ───────────────────────────────────────────────
    // Always attempt geocoding for new records
    let lat: number | null = null;
    let lng: number | null = null;

    const geo = await geocodeAddress(g99Clinic.clinic_address ?? "");
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      console.log(`[upsert-clinic] Geocoded new "${g99Clinic.clinic_name}" → ${lat}, ${lng}`);
    }

    const baseSlug = slugify(g99Clinic.clinic_name) || "clinic";
    const slug = await uniqueSlug(ourBusinessId, baseSlug);

    const row = await queryOne<{ id: string }>(
      `INSERT INTO clinics
         (business_id, name, slug, website, address, city, state, zip, country,
          phone, about, google_my_business, google_place_id,
          lat, lng, geo,
          data_source, g99_clinic_id, last_synced_at, is_active)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'US'),
          $10, $11, $12, $13,
          $14, $15,
          CASE WHEN $14::numeric IS NOT NULL AND $15::numeric IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint($15::float, $14::float), 4326)::geography
          END,
          'g99', $16, NOW(), true)
       RETURNING id`,
      [
        ourBusinessId,                   // $1
        g99Clinic.clinic_name,           // $2
        slug,                            // $3
        g99Clinic.clinic_website ?? "",   // $4
        g99Clinic.clinic_address,         // $5
        city,                             // $6
        state,                            // $7
        zip,                              // $8
        g99Clinic.clinic_country,         // $9
        g99Clinic.clinic_contact_number,  // $10
        g99Clinic.clinic_about,           // $11
        g99Clinic.google_my_business,     // $12
        g99Clinic.google_place_id,        // $13
        lat,                              // $14
        lng,                              // $15
        g99Clinic.clinic_id,              // $16
      ]
    );

    if (!row) throw new Error("Insert returned no row");
    return successResponse({ our_clinic_id: row.id });
  } catch (err) {
    return handleApiError(err);
  }
}
