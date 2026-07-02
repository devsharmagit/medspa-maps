/**
 * g99/source.ts — read businesses + clinics from the G99 source DB.
 *
 * IMPORTANT: the real G99 schema does NOT match what the legacy
 * /api/businesses/with-clinics and /api/internal/g99/businesses routes assume.
 * Reality (verified against the read replica):
 *   - clinics link to a business via `clinics.tenant_id = businesses.id`
 *     (the `business_clinic` join table is empty — do not use it)
 *   - soft-delete is the `deleted` boolean (NOT `is_active`)
 *   - there is no `images` table; business logo lives on `businesses.logo_url`
 *   - services attach via `service_clinic(clinic_id, service_id)` → `services`
 *   - `clinics.address` is a single combined string; city/state are usually null
 *   - test/internal businesses are flagged in `business_config` (by tenant_id)
 *
 * We only ever consider clinics that have a non-empty `website` (the import
 * scrapes that site for treatments/concerns/images).
 */

import { queryG99 } from "@/lib/db";

export interface G99Clinic {
  clinic_id: string;
  name: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  contact_number: string | null;
  about: string | null;
  google_my_business: string | null;
  google_place_id: string | null;
  google_profile_id: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  tiktok: string | null;
  yelp_url: string | null;
  appointment_url: string | null;
  clinic_url: string | null;
  /** services attached to this clinic in G99 (detail view only) */
  services?: G99Service[];
}

export interface G99Service {
  service_id: string;
  name: string | null;
  category: string | null;
}

export interface G99Business {
  business_id: string;
  name: string | null;
  website: string | null;
  logo_url: string | null;
  about: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  is_test: boolean;
  is_internal: boolean;
  clinics: G99Clinic[];
}

// Shared SELECT for a business' website-bearing clinics, aggregated to JSON.
// LATERAL keeps the business_config flags from multiplying the clinic rows.
const CLINIC_JSON = `
  json_agg(json_build_object(
    'clinic_id',          c.id::text,
    'name',               c.name,
    'website',            c.website,
    'address',            c.address,
    'city',               c.city,
    'state',              c.state,
    'country',            c.country,
    'contact_number',     c.contact_number,
    'about',              c.about,
    'google_my_business', c.google_my_business,
    'google_place_id',    c.google_place_id,
    'google_profile_id',  c.google_profile_id,
    'instagram',          c.instagram,
    'facebook',           c.facebook,
    'twitter',            c.twitter,
    'tiktok',             c.tiktok,
    'yelp_url',           c.yelp_url,
    'appointment_url',    c.appointment_url,
    'clinic_url',         c.clinic_url
  ) ORDER BY c.id)`;

const BASE_FROM = `
  FROM businesses b
  JOIN clinics c
    ON c.tenant_id = b.id
   AND c.deleted IS NOT TRUE
   AND c.website IS NOT NULL
   AND TRIM(c.website) <> ''
  LEFT JOIN LATERAL (
    SELECT bool_or(bc.is_test_business) AS is_test,
           bool_or(bc.internal_business) AS is_internal
    FROM business_config bc
    WHERE bc.tenant_id = b.id
  ) cfg ON TRUE
  WHERE b.deleted IS NOT TRUE`;

interface RawBizRow {
  business_id: string;
  name: string | null;
  website: string | null;
  logo_url: string | null;
  about: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  is_test: boolean | null;
  is_internal: boolean | null;
  clinics: G99Clinic[];
}

function mapBiz(r: RawBizRow): G99Business {
  return {
    business_id: r.business_id,
    name: r.name,
    website: r.website,
    logo_url: r.logo_url,
    about: r.about,
    city: r.city,
    state: r.state,
    country: r.country,
    phone: r.phone,
    is_test: Boolean(r.is_test),
    is_internal: Boolean(r.is_internal),
    clinics: r.clinics ?? [],
  };
}

/**
 * List every G99 business that has at least one website-bearing clinic, with
 * those clinics nested. ~160 rows — cheap enough to return in full.
 */
export async function listG99Businesses(): Promise<G99Business[]> {
  const rows = await queryG99<RawBizRow>(`
    SELECT
      b.id::text  AS business_id,
      b.name,
      b.website,
      b.logo_url,
      b.about,
      b.city,
      b.state,
      b.country,
      b.phone,
      cfg.is_test,
      cfg.is_internal,
      ${CLINIC_JSON} AS clinics
    ${BASE_FROM}
    GROUP BY b.id, cfg.is_test, cfg.is_internal
    ORDER BY lower(b.name)
  `);
  return rows.map(mapBiz);
}

/**
 * Fetch a single G99 business by id, with its website-clinics and each clinic's
 * G99 services attached (used for the detail view).
 */
export async function getG99Business(businessId: string): Promise<G99Business | null> {
  const rows = await queryG99<RawBizRow>(
    `
    SELECT
      b.id::text  AS business_id,
      b.name,
      b.website,
      b.logo_url,
      b.about,
      b.city,
      b.state,
      b.country,
      b.phone,
      cfg.is_test,
      cfg.is_internal,
      ${CLINIC_JSON} AS clinics
    ${BASE_FROM}
      AND b.id = $1
    GROUP BY b.id, cfg.is_test, cfg.is_internal
    `,
    [businessId]
  );
  if (rows.length === 0) return null;
  const biz = mapBiz(rows[0]);

  const clinicIds = biz.clinics.map((c) => c.clinic_id);
  if (clinicIds.length > 0) {
    const svc = await queryG99<{ clinic_id: string } & G99Service>(
      `
      SELECT scl.clinic_id::text AS clinic_id,
             s.id::text          AS service_id,
             s.name              AS name,
             sc.name             AS category
      FROM service_clinic scl
      JOIN services s ON s.id = scl.service_id AND s.deleted IS NOT TRUE
      LEFT JOIN service_categories sc ON sc.id = s.service_category_id
      WHERE scl.deleted IS NOT TRUE
        AND scl.clinic_id = ANY($1::bigint[])
      ORDER BY sc.name NULLS LAST, s.name
      `,
      [clinicIds]
    );
    const byClinic = new Map<string, G99Service[]>();
    for (const row of svc) {
      const list = byClinic.get(row.clinic_id) ?? [];
      list.push({ service_id: row.service_id, name: row.name, category: row.category });
      byClinic.set(row.clinic_id, list);
    }
    for (const c of biz.clinics) c.services = byClinic.get(c.clinic_id) ?? [];
  }

  return biz;
}

/** Find a single G99 clinic (by clinic id) plus the business it belongs to. */
export async function getG99Clinic(
  clinicId: string
): Promise<{ business: G99Business; clinic: G99Clinic } | null> {
  const bizIdRow = await queryG99<{ business_id: string }>(
    `SELECT tenant_id::text AS business_id FROM clinics WHERE id = $1`,
    [clinicId]
  );
  const businessId = bizIdRow[0]?.business_id;
  if (!businessId) return null;
  const business = await getG99Business(businessId);
  if (!business) return null;
  const clinic = business.clinics.find((c) => c.clinic_id === clinicId);
  if (!clinic) return null;
  return { business, clinic };
}
