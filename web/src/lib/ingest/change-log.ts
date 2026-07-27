/**
 * ingest/change-log.ts — persist what each refresh run did.
 *
 * Two tables:
 *   `clinic_refresh_runs`     one row per attempt, including SKIPPED attempts.
 *                             A clinic whose crawl has been failing for months
 *                             would otherwise be indistinguishable from one
 *                             that has genuinely not changed — both would have
 *                             an empty history.
 *   `clinic_catalog_changes`  the added/removed canonical rows for that run.
 *
 * Every function takes a `PoolClient` rather than reaching for the pool, so the
 * snapshot and the write happen inside the CALLER's transaction. Reading the
 * before-snapshot on a separate connection would open a torn-read window where
 * a concurrent admin edit gets logged as a change nobody made.
 */

import type { PoolClient } from "pg";
import type { CatalogChange, CatalogMember, CatalogSnapshot } from "@/lib/ingest/catalog-diff";
import type { RefreshTrigger } from "@/lib/ingest/ingest-treatments-concerns";

/**
 * A clinic's canonical services + concerns right now.
 *
 * Services join through `service_id`, so unmatched rows (`service_id IS NULL`)
 * drop out here — exactly the exclusion `catalog-diff.ts` documents.
 * Concerns use effective membership: active `scraped`/`manual` minus active
 * `removed` (the admin suppression), matching `lib/clinics/queries.ts`.
 */
export async function readCatalogSnapshot(
  client: PoolClient,
  clinicId: string
): Promise<CatalogSnapshot> {
  const services = await client.query<CatalogMember>(
    `SELECT DISTINCT s.id AS "entityId", s.name, s.slug
       FROM clinic_services cs
       JOIN services s ON s.id = cs.service_id
      WHERE cs.clinic_id = $1 AND cs.is_active`,
    [clinicId]
  );
  const concerns = await client.query<CatalogMember>(
    `SELECT DISTINCT c.id AS "entityId", c.name, c.slug
       FROM clinic_concerns cc
       JOIN concerns c ON c.id = cc.concern_id
      WHERE cc.clinic_id = $1 AND cc.is_active AND cc.source <> 'removed'`,
    [clinicId]
  );
  return { services: services.rows, concerns: concerns.rows };
}

export interface RefreshRunRecord {
  clinicId: string;
  trigger: RefreshTrigger;
  status: "saved" | "skipped" | "failed";
  crawlHealth?: number | null;
  pagesRequested?: number | null;
  pagesFetched?: number | null;
  servicesBefore?: number | null;
  servicesAfter?: number | null;
  concernsBefore?: number | null;
  concernsAfter?: number | null;
  note?: string | null;
  startedAt: Date;
}

/** Insert the run row and return its id. */
export async function writeRefreshRun(
  client: PoolClient,
  run: RefreshRunRecord
): Promise<string> {
  const res = await client.query<{ id: string }>(
    `INSERT INTO clinic_refresh_runs
       (clinic_id, trigger, status, crawl_health, pages_requested, pages_fetched,
        services_before, services_after, concerns_before, concerns_after,
        note, started_at, finished_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
     RETURNING id`,
    [
      run.clinicId,
      run.trigger,
      run.status,
      run.crawlHealth ?? null,
      run.pagesRequested ?? null,
      run.pagesFetched ?? null,
      run.servicesBefore ?? null,
      run.servicesAfter ?? null,
      run.concernsBefore ?? null,
      run.concernsAfter ?? null,
      run.note ?? null,
      run.startedAt,
    ]
  );
  return res.rows[0].id;
}

/**
 * Insert the delta rows for a run, in one statement.
 *
 * `entity_id` intentionally carries no foreign key and `name`/`slug` are frozen
 * copies: a CASCADE FK would let `dedupe-services.ts` / `clean-catalog-junk.ts`
 * erase history the next time the catalog is curated.
 */
export async function writeCatalogChanges(
  client: PoolClient,
  runId: string,
  clinicId: string,
  delta: { added: CatalogChange[]; removed: CatalogChange[] }
): Promise<number> {
  const rows = [
    ...delta.added.map((c) => ({ ...c, changeType: "added" as const })),
    ...delta.removed.map((c) => ({ ...c, changeType: "removed" as const })),
  ];
  if (rows.length === 0) return 0;

  await client.query(
    `INSERT INTO clinic_catalog_changes
       (run_id, clinic_id, entity_type, change_type, entity_id, name, slug)
     SELECT $1, $2, t.entity_type, t.change_type, t.entity_id, t.name, t.slug
       FROM unnest($3::text[], $4::text[], $5::uuid[], $6::text[], $7::text[])
         AS t(entity_type, change_type, entity_id, name, slug)`,
    [
      runId,
      clinicId,
      rows.map((r) => r.entityType),
      rows.map((r) => r.changeType),
      rows.map((r) => r.entityId),
      rows.map((r) => r.name),
      rows.map((r) => r.slug),
    ]
  );
  return rows.length;
}
