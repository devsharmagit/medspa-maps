/**
 * concerns/clinic-concerns.ts — the concern membership model for a clinic.
 *
 * SCRAPED concerns = clinic_concerns rows with source='scraped' — asserted by
 *   the concerns ingest ONLY when the clinic's own website explicitly names the
 *   condition.
 * EFFECTIVE concerns = (SCRAPED ∪ active source='manual') − (active source='removed').
 *
 * NOTE: concerns are NO LONGER derived from the clinic's services for display —
 * "offers Botox ⇒ treats wrinkles" was guesswork and is gone. deriveConcernSlugs
 * remains exported for informational/admin use only.
 *
 * When an admin saves a desired concern-slug set S (the edit UI expresses only
 * the CANONICAL_CONCERNS universe), the diff runs against the scraped baseline
 * WITHIN that universe:
 *   additions = S − scraped → upsert source='manual', is_active=true
 *   removals  = scraped − S → flip that row to source='removed' (suppresses it)
 *   other active manual/removed rows in the universe → is_active=false
 * Scraped rows outside the canonical universe (AI-grown concerns the UI can't
 * express) are never touched by admin saves.
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
 * Service-DERIVED concern slugs (CANONICAL_CONCERNS whose serviceSlugs intersect
 * the matched set). Informational only — NOT part of effective membership.
 */
export function deriveConcernSlugs(matchedServiceSlugs: Iterable<string>): string[] {
  const have = new Set(matchedServiceSlugs);
  return CANONICAL_CONCERNS.filter((c) =>
    c.serviceSlugs.some((s) => have.has(s))
  ).map((c) => c.slug);
}

/** Active clinic_concerns rows for a clinic, keyed by source. */
async function getConcernRows(
  clinicId: string,
  executor: QueryExecutor
): Promise<Array<{ slug: string; source: string }>> {
  const { rows } = await executor.query<{ slug: string; source: string }>(
    `SELECT c.slug, cc.source
       FROM clinic_concerns cc
       JOIN concerns c ON c.id = cc.concern_id AND c.is_active = true
      WHERE cc.clinic_id = $1 AND cc.is_active = true`,
    [clinicId]
  );
  return rows;
}

/** Stable ordering: canonical catalog order first, then the rest by name. */
function orderConcernSlugs(slugs: Iterable<string>): string[] {
  const set = new Set(slugs);
  const canonical = CANONICAL_CONCERNS.filter((c) => set.has(c.slug)).map((c) => c.slug);
  const rest = [...set].filter((s) => !canonical.includes(s)).sort();
  return [...canonical, ...rest];
}

/** Active source='scraped' concern slugs (evidence-backed). */
export async function getScrapedConcernSlugs(
  clinicId: string,
  executor: QueryExecutor = pool
): Promise<string[]> {
  const rows = await getConcernRows(clinicId, executor);
  return orderConcernSlugs(rows.filter((r) => r.source === "scraped").map((r) => r.slug));
}

/**
 * EFFECTIVE concern slugs for a clinic:
 * (scraped ∪ active manual) − (active removed). No service-derived guessing.
 */
export async function getEffectiveConcernSlugs(
  clinicId: string,
  executor: QueryExecutor = pool
): Promise<string[]> {
  const rows = await getConcernRows(clinicId, executor);
  const effective = new Set<string>();
  for (const r of rows) {
    if (r.source === "scraped" || r.source === "manual") effective.add(r.slug);
  }
  for (const r of rows) {
    if (r.source === "removed") effective.delete(r.slug);
  }
  return orderConcernSlugs(effective);
}

/**
 * Persist admin overrides so the clinic's EFFECTIVE concern set — within the
 * CANONICAL_CONCERNS universe the edit UI can express — equals desiredConcernSlugs.
 * Scraped rows for non-canonical (AI-grown) concerns are untouched.
 *
 * Accepts an optional executor (PoolClient) so it can run inside an existing
 * transaction. Idempotent via ON CONFLICT (clinic_id, concern_id).
 */
export async function saveClinicConcerns(
  clinicId: string,
  desiredConcernSlugs: string[],
  executor: QueryExecutor = pool
): Promise<string[]> {
  // The admin UI only expresses canonical concerns; diff within that universe.
  const canonicalSlugs = new Set(CANONICAL_CONCERNS.map((c) => c.slug));
  const desired = new Set(desiredConcernSlugs.filter((s) => canonicalSlugs.has(s)));

  const rows = await getConcernRows(clinicId, executor);
  const scraped = new Set(
    rows.filter((r) => r.source === "scraped" && canonicalSlugs.has(r.slug)).map((r) => r.slug)
  );

  const additions: string[] = []; // desired but not evidence-backed → manual
  const removals: string[] = []; // evidence-backed but not desired → suppressed
  for (const slug of desired) if (!scraped.has(slug)) additions.push(slug);
  for (const slug of scraped) if (!desired.has(slug)) removals.push(slug);

  // Resolve slug → concern id (only the slugs we touch).
  const touched = [...new Set([...additions, ...removals])];
  const idBySlug = new Map<string, string>();
  if (touched.length > 0) {
    const { rows: idRows } = await executor.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM concerns WHERE slug = ANY($1::text[])`,
      [touched]
    );
    for (const r of idRows) idBySlug.set(r.slug, r.id);
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

  // Deactivate stale override rows not in (additions ∪ removals). NEVER touch
  // scraped rows — evidence-backed membership is the ingest's to manage.
  if (keepIds.length > 0) {
    await executor.query(
      `UPDATE clinic_concerns
          SET is_active = false, updated_at = NOW()
        WHERE clinic_id = $1 AND is_active = true
          AND source IN ('manual','removed')
          AND concern_id <> ALL($2::uuid[])`,
      [clinicId, keepIds]
    );
  } else {
    await executor.query(
      `UPDATE clinic_concerns
          SET is_active = false, updated_at = NOW()
        WHERE clinic_id = $1 AND is_active = true
          AND source IN ('manual','removed')`,
      [clinicId]
    );
  }

  return getEffectiveConcernSlugs(clinicId, executor);
}
