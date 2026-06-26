/**
 * concerns/clinic-concerns.ts — the concern override model for a clinic.
 *
 * DERIVED concerns = CANONICAL_CONCERNS whose serviceSlugs intersect the
 *   clinic's matched canonical service slugs.
 * EFFECTIVE concerns = (DERIVED ∪ active source='manual') − (active source='removed').
 *
 * When an admin saves a desired concern-slug set S relative to DERIVED D:
 *   additions = S − D  → clinic_concerns source='manual', is_active=true
 *   removals  = D − S  → clinic_concerns source='removed', is_active=true
 *   any other active row for this clinic → is_active=false
 *
 * All persistence is idempotent (ON CONFLICT (clinic_id, concern_id)) and
 * recomputed cleanly on every save.
 */

import pool from "@/lib/db";
import { CANONICAL_CONCERNS } from "@/lib/taxonomy/canonical";

/**
 * Minimal query executor — satisfied by both the shared Pool and a PoolClient,
 * so saveClinicConcerns() can run standalone or inside an existing transaction.
 */
export interface QueryExecutor {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
}

/** Canonical service slugs the clinic currently offers (matched, active). */
export async function getClinicMatchedServiceSlugs(
  clinicId: string,
  executor: QueryExecutor = pool
): Promise<string[]> {
  const { rows } = await executor.query<{ slug: string }>(
    `SELECT DISTINCT s.slug
       FROM services s
       JOIN clinic_services cs ON cs.service_id = s.id
      WHERE cs.clinic_id = $1 AND cs.is_active = true AND s.is_active = true`,
    [clinicId]
  );
  return rows.map((r) => r.slug);
}

/**
 * DERIVED concern slugs for a set of matched canonical service slugs — the
 * CANONICAL_CONCERNS whose serviceSlugs intersect the matched set, in catalog
 * order. Mirrors deriveConcernServicesForClinic in src/lib/admin/clinic-save.ts.
 */
export function deriveConcernSlugs(matchedServiceSlugs: Iterable<string>): string[] {
  const have = new Set(matchedServiceSlugs);
  return CANONICAL_CONCERNS.filter((c) =>
    c.serviceSlugs.some((s) => have.has(s))
  ).map((c) => c.slug);
}

/**
 * EFFECTIVE concern slugs for a clinic per the override model:
 * (derived ∪ active manual) − (active removed), in CANONICAL_CONCERNS order.
 */
export async function getEffectiveConcernSlugs(
  clinicId: string,
  executor: QueryExecutor = pool
): Promise<string[]> {
  const matched = await getClinicMatchedServiceSlugs(clinicId, executor);
  const derived = new Set(deriveConcernSlugs(matched));

  const { rows } = await executor.query<{ slug: string; source: string }>(
    `SELECT c.slug, cc.source
       FROM clinic_concerns cc
       JOIN concerns c ON c.id = cc.concern_id
      WHERE cc.clinic_id = $1 AND cc.is_active = true`,
    [clinicId]
  );

  const effective = new Set(derived);
  for (const row of rows) {
    if (row.source === "manual") effective.add(row.slug);
  }
  for (const row of rows) {
    if (row.source === "removed") effective.delete(row.slug);
  }

  return CANONICAL_CONCERNS.filter((c) => effective.has(c.slug)).map((c) => c.slug);
}

/**
 * Persist the override rows so the clinic's EFFECTIVE concern set equals
 * desiredConcernSlugs, RELATIVE to the DERIVED set:
 *   additions = desired − derived → upsert source='manual', is_active=true
 *   removals  = derived − desired → upsert source='removed', is_active=true
 *   every other clinic_concerns row for this clinic → is_active=false
 *
 * Accepts an optional executor (PoolClient) so it can run inside an existing
 * transaction. Idempotent via ON CONFLICT (clinic_id, concern_id).
 */
export async function saveClinicConcerns(
  clinicId: string,
  desiredConcernSlugs: string[],
  executor: QueryExecutor = pool
): Promise<string[]> {
  const matched = await getClinicMatchedServiceSlugs(clinicId, executor);
  const derived = new Set(deriveConcernSlugs(matched));

  // Only consider canonical concern slugs; ignore anything unknown.
  const canonicalSlugs = new Set(CANONICAL_CONCERNS.map((c) => c.slug));
  const desired = new Set(
    desiredConcernSlugs.filter((s) => canonicalSlugs.has(s))
  );

  const additions: string[] = [];
  const removals: string[] = [];
  for (const slug of desired) if (!derived.has(slug)) additions.push(slug);
  for (const slug of derived) if (!desired.has(slug)) removals.push(slug);

  // Resolve slug → concern id (only the slugs we touch).
  const touched = [...new Set([...additions, ...removals])];
  const idBySlug = new Map<string, string>();
  if (touched.length > 0) {
    const { rows } = await executor.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM concerns WHERE slug = ANY($1::text[])`,
      [touched]
    );
    for (const r of rows) idBySlug.set(r.slug, r.id);
  }

  const keepIds: string[] = [];

  for (const slug of additions) {
    const concernId = idBySlug.get(slug);
    if (!concernId) continue;
    keepIds.push(concernId);
    await executor.query(
      `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active)
       VALUES ($1, $2, 'manual', true)
       ON CONFLICT (clinic_id, concern_id) DO UPDATE SET
         source = 'manual',
         is_active = true,
         updated_at = NOW()`,
      [clinicId, concernId]
    );
  }

  for (const slug of removals) {
    const concernId = idBySlug.get(slug);
    if (!concernId) continue;
    keepIds.push(concernId);
    await executor.query(
      `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active)
       VALUES ($1, $2, 'removed', true)
       ON CONFLICT (clinic_id, concern_id) DO UPDATE SET
         source = 'removed',
         is_active = true,
         updated_at = NOW()`,
      [clinicId, concernId]
    );
  }

  // Deactivate any stale override rows not in (additions ∪ removals).
  if (keepIds.length > 0) {
    await executor.query(
      `UPDATE clinic_concerns
          SET is_active = false, updated_at = NOW()
        WHERE clinic_id = $1 AND is_active = true
          AND concern_id <> ALL($2::uuid[])`,
      [clinicId, keepIds]
    );
  } else {
    await executor.query(
      `UPDATE clinic_concerns
          SET is_active = false, updated_at = NOW()
        WHERE clinic_id = $1 AND is_active = true`,
      [clinicId]
    );
  }

  return getEffectiveConcernSlugs(clinicId, executor);
}
