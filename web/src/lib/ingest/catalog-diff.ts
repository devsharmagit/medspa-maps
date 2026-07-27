/**
 * ingest/catalog-diff.ts — what a clinic gained and lost in one refresh.
 *
 * Pure, no DB, so the diff rules are testable without a crawl. Two rules matter
 * and both are deliberate:
 *
 *   1. The key is the CANONICAL catalog id, never the scraped `raw_name`.
 *      "Botox® Cosmetic" renamed to "Botox Injections" both resolve to the
 *      `botox` service, so that is not a change and must not be logged as one.
 *   2. Rows with no canonical id (`clinic_services.service_id IS NULL`,
 *      i.e. match_status 'unmatched') are excluded by the caller before they
 *      get here — they have no stable key, they never surface publicly, and
 *      they are the noisiest churn in the data.
 */

/** One canonical catalog row a clinic gained or lost. */
export interface CatalogChange {
  entityType: "service" | "concern";
  entityId: string;
  /** Frozen at diff time — the catalog row may later be merged or renamed. */
  name: string;
  slug: string | null;
}

/** A catalog row as it exists on a clinic at one point in time. */
export interface CatalogMember {
  entityId: string;
  name: string;
  slug: string | null;
}

/** A clinic's canonical services + concerns at one point in time. */
export interface CatalogSnapshot {
  services: CatalogMember[];
  concerns: CatalogMember[];
}

export interface CatalogDelta {
  added: CatalogChange[];
  removed: CatalogChange[];
}

function diffOne(
  entityType: "service" | "concern",
  before: CatalogMember[],
  after: CatalogMember[]
): CatalogDelta {
  const beforeIds = new Set(before.map((e) => e.entityId));
  const afterIds = new Set(after.map((e) => e.entityId));
  const toChange = (e: CatalogMember): CatalogChange => ({
    entityType,
    entityId: e.entityId,
    name: e.name,
    slug: e.slug,
  });
  return {
    added: after.filter((e) => !beforeIds.has(e.entityId)).map(toChange),
    removed: before.filter((e) => !afterIds.has(e.entityId)).map(toChange),
  };
}

/**
 * Diff two snapshots.
 *
 * A FIRST-EVER import (both before-sets empty) returns an empty delta. Logging
 * it would emit ~130 "added" rows per new clinic and turn the history page into
 * a list of imports; and "what did this clinic have at import" is already
 * readable from `clinic_services` / `clinic_concerns`. What is NOT recoverable
 * from those tables is a removal, so the log is biased toward removals and
 * genuine later additions. The run row still records the import.
 */
export function diffCatalog(before: CatalogSnapshot, after: CatalogSnapshot): CatalogDelta {
  if (before.services.length === 0 && before.concerns.length === 0) {
    return { added: [], removed: [] };
  }
  const svc = diffOne("service", before.services, after.services);
  const con = diffOne("concern", before.concerns, after.concerns);
  return {
    added: [...svc.added, ...con.added],
    removed: [...svc.removed, ...con.removed],
  };
}
