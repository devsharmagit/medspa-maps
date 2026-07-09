import { query, queryOne } from "@/lib/db";
import type { Provider, ProviderSummary, ProviderPayload } from "./types";

// ── READ ──────────────────────────────────────────────────────────────────────

/** Fetch all providers for a given clinic (slim summary). */
export async function getProvidersByClinicId(
  clinicId: string
): Promise<ProviderSummary[]> {
  return query<ProviderSummary>(
    `SELECT id, clinic_id, name, title, image_url, is_verified,
            years_experience, is_active, created_at
       FROM providers
      WHERE clinic_id = $1
      ORDER BY created_at ASC`,
    [clinicId]
  );
}

/** Slim provider row used on the public concern page's provider grid. */
export interface ConcernProvider {
  id: string;
  name: string;
  title: string | null;
  card_tagline: string | null;
  image_url: string | null;
  years_experience: number | null;
  is_verified: boolean;
  clinic_slug: string;
  clinic_name: string;
  avg_rating: string | null;
  review_rating: string | null;
  review_count: number;
}

/**
 * Fetch providers at clinics that treat the given concern.
 * Sorted (in JS) featured DESC, is_verified DESC, avg_rating DESC and capped.
 */
export async function getProvidersByConcernId(
  concernId: string
): Promise<ConcernProvider[]> {
  type Row = ConcernProvider & { featured: boolean; verified: boolean };

  // A provider shows on a concern page when ANY of these hold:
  //  1. explicitly linked to the concern        (provider_concerns)
  //  2. performs a treatment that treats it      (provider_services → concern_services)
  //  3. works at a clinic that treats it         (clinic_services → concern_services)
  // The explicit link (1) lets an admin define a provider for a concern even when
  // their clinic doesn't otherwise cover it; (2)/(3) keep the list populated.
  const rows = await query<Row>(
    `SELECT DISTINCT ON (pr.id)
       pr.id, pr.name, pr.title, pr.card_tagline, pr.image_url, pr.years_experience,
       pr.is_verified, pr.review_rating, pr.review_count,
       cl.slug AS clinic_slug, cl.name AS clinic_name, cl.featured, cl.verified, cl.avg_rating
     FROM providers pr
     JOIN clinics cl ON cl.id = pr.clinic_id AND cl.is_active = true
     WHERE pr.is_active = true
       AND (
         EXISTS (
           SELECT 1 FROM provider_concerns pc
            WHERE pc.provider_id = pr.id AND pc.concern_id = $1
         )
         OR EXISTS (
           SELECT 1 FROM provider_services ps
             JOIN concern_services cs ON cs.service_id = ps.service_id
            WHERE ps.provider_id = pr.id AND cs.concern_id = $1
         )
         OR EXISTS (
           SELECT 1 FROM clinic_services cls
             JOIN concern_services cs2 ON cs2.service_id = cls.service_id
            WHERE cls.clinic_id = pr.clinic_id AND cls.is_active = true
              AND cs2.concern_id = $1
         )
       )
     ORDER BY pr.id`,
    [concernId]
  );

  return rows
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.is_verified !== b.is_verified) return a.is_verified ? -1 : 1;
      return (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0);
    })
    .slice(0, 12)
    .map(({ featured: _featured, verified: _verified, ...p }) => p);
}

/**
 * Fetch active providers, sorted by featured clinic status, then verified, then
 * rating. Pass `limit` to cap the result (e.g. the landing-page spotlight).
 */
export async function getAllProviders(
  limit?: number,
  opts: { requireImage?: boolean } = {}
): Promise<ConcernProvider[]> {
  type Row = ConcernProvider & { featured: boolean; verified: boolean };

  const rows = await query<Row>(
    `SELECT
       pr.id, pr.name, pr.title, pr.card_tagline, pr.image_url, pr.years_experience,
       pr.is_verified, pr.review_rating, pr.review_count,
       cl.slug AS clinic_slug, cl.name AS clinic_name, cl.featured, cl.verified, cl.avg_rating
     FROM providers pr
     JOIN clinics cl ON cl.id = pr.clinic_id AND cl.is_active = true
     WHERE pr.is_active = true
       ${opts.requireImage ? "AND pr.image_url IS NOT NULL AND pr.image_url <> ''" : ""}
     ORDER BY cl.featured DESC, pr.is_verified DESC, pr.review_rating DESC NULLS LAST
     ${limit != null ? "LIMIT $1" : ""}`,
    limit != null ? [limit] : []
  );

  return rows.map(({ featured: _featured, verified: _verified, ...p }) => p);
}

/** Fetch a single full provider row by ID. */
export async function getProviderById(id: string): Promise<Provider | null> {
  return queryOne<Provider>(
    `SELECT id, clinic_id, name, title, bio, card_tagline, review_rating,
            review_count, image_url, years_experience,
            is_verified, highlights, credentials, specialties,
            is_active, created_at, updated_at
       FROM providers
      WHERE id = $1`,
    [id]
  );
}

/** Fetch canonical service (treatment) IDs linked to a provider. */
export async function getProviderServiceIds(
  providerId: string
): Promise<string[]> {
  const rows = await query<{ service_id: string }>(
    `SELECT service_id FROM provider_services WHERE provider_id = $1`,
    [providerId]
  );
  return rows.map((r) => r.service_id);
}

/** Fetch concern IDs linked to a provider. */
export async function getProviderConcernIds(
  providerId: string
): Promise<string[]> {
  const rows = await query<{ concern_id: string }>(
    `SELECT concern_id FROM provider_concerns WHERE provider_id = $1`,
    [providerId]
  );
  return rows.map((r) => r.concern_id);
}

// ── WRITE ─────────────────────────────────────────────────────────────────────

/** Create a new provider for a clinic. Returns the created provider. */
export async function createProvider(
  clinicId: string,
  payload: ProviderPayload
): Promise<Provider> {
  const {
    name,
    title = null,
    bio = null,
    card_tagline = null,
    review_rating = null,
    review_count = 0,
    image_url = null,
    years_experience = null,
    is_verified = false,
    highlights = [],
    credentials = [],
    specialties = [],
    service_ids = [],
    concern_ids = [],
  } = payload;

  const rows = await query<Provider>(
    `INSERT INTO providers
       (clinic_id, name, title, bio, card_tagline, review_rating, review_count,
        image_url, years_experience,
        is_verified, highlights, credentials, specialties)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, clinic_id, name, title, bio, card_tagline, review_rating,
               review_count, image_url, years_experience,
               is_verified, highlights, credentials, specialties,
               is_active, created_at, updated_at`,
    [
      clinicId,
      name,
      title,
      bio,
      card_tagline,
      review_rating,
      review_count ?? 0,
      image_url,
      years_experience,
      is_verified,
      JSON.stringify(highlights),
      JSON.stringify(credentials),
      JSON.stringify(specialties),
    ]
  );

  const provider = rows[0];

  // Link services
  if (service_ids.length > 0) {
    await syncProviderServices(provider.id, service_ids);
  }
  // Link concerns
  if (concern_ids.length > 0) {
    await syncProviderConcerns(provider.id, concern_ids);
  }

  return provider;
}

/** Update an existing provider. Returns the updated row. */
export async function updateProvider(
  id: string,
  payload: Partial<ProviderPayload>
): Promise<Provider | null> {
  const {
    name,
    title,
    bio,
    card_tagline,
    review_rating,
    review_count,
    image_url,
    years_experience,
    is_verified,
    highlights,
    credentials,
    specialties,
    service_ids,
    concern_ids,
  } = payload;

  const rows = await query<Provider>(
    `UPDATE providers SET
       name             = COALESCE($2, name),
       title            = COALESCE($3, title),
       bio              = COALESCE($4, bio),
       card_tagline     = COALESCE($5, card_tagline),
       review_rating    = COALESCE($6, review_rating),
       review_count     = COALESCE($7, review_count),
       image_url        = COALESCE($8, image_url),
       years_experience = COALESCE($9, years_experience),
       is_verified      = COALESCE($10, is_verified),
       highlights       = COALESCE($11, highlights),
       credentials      = COALESCE($12, credentials),
       specialties      = COALESCE($13, specialties),
       updated_at       = NOW()
     WHERE id = $1
     RETURNING id, clinic_id, name, title, bio, card_tagline, review_rating,
               review_count, image_url, years_experience,
               is_verified, highlights, credentials, specialties,
               is_active, created_at, updated_at`,
    [
      id,
      name ?? null,
      title !== undefined ? title : null,
      bio !== undefined ? bio : null,
      card_tagline !== undefined ? card_tagline : null,
      review_rating !== undefined ? review_rating : null,
      review_count !== undefined ? review_count : null,
      image_url !== undefined ? image_url : null,
      years_experience !== undefined ? years_experience : null,
      is_verified !== undefined ? is_verified : null,
      highlights ? JSON.stringify(highlights) : null,
      credentials ? JSON.stringify(credentials) : null,
      specialties ? JSON.stringify(specialties) : null,
    ]
  );

  if (!rows[0]) return null;

  if (service_ids !== undefined) {
    await syncProviderServices(id, service_ids);
  }
  if (concern_ids !== undefined) {
    await syncProviderConcerns(id, concern_ids);
  }

  return rows[0];
}

/** Toggle a provider's active (public visibility) state. Returns the slim row or null. */
export async function setProviderActive(
  id: string,
  isActive: boolean
): Promise<ProviderSummary | null> {
  return queryOne<ProviderSummary>(
    `UPDATE providers SET is_active = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, clinic_id, name, title, image_url, is_verified,
                 years_experience, is_active, created_at`,
    [id, isActive]
  );
}

/** Delete a provider by ID. Returns true if a row was deleted. */
export async function deleteProvider(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM providers WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows.length > 0;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

/** Replace the full set of service links for a provider. */
async function syncProviderServices(
  providerId: string,
  serviceIds: string[]
): Promise<void> {
  // Remove existing links
  await query(
    `DELETE FROM provider_services WHERE provider_id = $1`,
    [providerId]
  );

  if (serviceIds.length === 0) return;

  // Bulk insert new links
  const values = serviceIds
    .map((_, i) => `($1, $${i + 2})`)
    .join(", ");
  await query(
    `INSERT INTO provider_services (provider_id, service_id) VALUES ${values}
     ON CONFLICT DO NOTHING`,
    [providerId, ...serviceIds]
  );
}

/** Replace the full set of concern links for a provider. */
async function syncProviderConcerns(
  providerId: string,
  concernIds: string[]
): Promise<void> {
  await query(
    `DELETE FROM provider_concerns WHERE provider_id = $1`,
    [providerId]
  );

  if (concernIds.length === 0) return;

  const values = concernIds
    .map((_, i) => `($1, $${i + 2})`)
    .join(", ");
  await query(
    `INSERT INTO provider_concerns (provider_id, concern_id) VALUES ${values}
     ON CONFLICT DO NOTHING`,
    [providerId, ...concernIds]
  );
}
