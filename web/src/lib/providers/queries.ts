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

/** Fetch a single full provider row by ID. */
export async function getProviderById(id: string): Promise<Provider | null> {
  return queryOne<Provider>(
    `SELECT id, clinic_id, name, title, bio, image_url, years_experience,
            is_verified, highlights, credentials, specialties,
            is_active, created_at, updated_at
       FROM providers
      WHERE id = $1`,
    [id]
  );
}

/** Fetch clinic_service IDs linked to a provider. */
export async function getProviderServiceIds(
  providerId: string
): Promise<string[]> {
  const rows = await query<{ service_id: string }>(
    `SELECT service_id FROM provider_services WHERE provider_id = $1`,
    [providerId]
  );
  return rows.map((r) => r.service_id);
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
    image_url = null,
    years_experience = null,
    is_verified = false,
    highlights = [],
    credentials = [],
    specialties = [],
    service_ids = [],
  } = payload;

  const rows = await query<Provider>(
    `INSERT INTO providers
       (clinic_id, name, title, bio, image_url, years_experience,
        is_verified, highlights, credentials, specialties)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, clinic_id, name, title, bio, image_url, years_experience,
               is_verified, highlights, credentials, specialties,
               is_active, created_at, updated_at`,
    [
      clinicId,
      name,
      title,
      bio,
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
    image_url,
    years_experience,
    is_verified,
    highlights,
    credentials,
    specialties,
    service_ids,
  } = payload;

  const rows = await query<Provider>(
    `UPDATE providers SET
       name             = COALESCE($2, name),
       title            = COALESCE($3, title),
       bio              = COALESCE($4, bio),
       image_url        = COALESCE($5, image_url),
       years_experience = COALESCE($6, years_experience),
       is_verified      = COALESCE($7, is_verified),
       highlights       = COALESCE($8, highlights),
       credentials      = COALESCE($9, credentials),
       specialties      = COALESCE($10, specialties),
       updated_at       = NOW()
     WHERE id = $1
     RETURNING id, clinic_id, name, title, bio, image_url, years_experience,
               is_verified, highlights, credentials, specialties,
               is_active, created_at, updated_at`,
    [
      id,
      name ?? null,
      title !== undefined ? title : null,
      bio !== undefined ? bio : null,
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

  return rows[0];
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
