/**
 * catalog-policy.ts — the closed-catalog gate for the ingest path.
 *
 * The 2026-09-06 reduction expressed "not part of the public taxonomy" as
 * `is_active = false` on 1,064 services and 200 concerns. Nothing enforced that
 * afterwards: `saveClinicServices` and `resolveConcernRow` both mint a fresh
 * `origin='ai', is_active=true` row whenever a scraped name does not match the
 * live catalog. Every refresh pass therefore grew the public taxonomy back —
 * a monthly cron (`CRON_SCHEDULE=0 3 1 * *`) would have undone the reduction
 * one clinic at a time. See docs/INGESTION-ISSUES.md defect 6.
 *
 * CLOSED (the default) means: a scraped name resolves onto a row that is
 * already active, or it is dropped. Never created.
 *
 * Dropping is not the common case, and that is the point of doing this AFTER
 * the reduction rather than instead of it: LEGACY_TREATMENT_REDIRECT maps 543
 * retired treatment names and LEGACY_CONCERN_REDIRECT 55 concern names onto the
 * core entries that absorbed them, so "Morpheus8" still lands on RF
 * Microneedling and "Hyperpigmentation" on Pigmentation. The redirect map is
 * consulted BEFORE a name is given up on, and only genuinely unrecognised text
 * falls through.
 *
 * OPEN restores the old grow-on-demand behaviour for tooling that deliberately
 * wants to extend the catalog (a future curated expansion, a one-off import
 * that is reviewed by hand). It is opt-in per process:
 *
 *   CATALOG_POLICY=open bun --env-file=.env scripts/<whatever>.ts
 *
 * It is deliberately NOT a per-call argument. Ingest has three entry points
 * (admin add-website, g99 import, cron refresh) that all funnel through the
 * same two resolvers, and a per-call flag is exactly how one of them ends up
 * quietly re-opening the catalog.
 */
import { coreTreatmentFor, coreConcernFor } from "./core-catalog";

export type CatalogPolicy = "closed" | "open";

/** Current policy. Closed unless CATALOG_POLICY is explicitly "open". */
export function catalogPolicy(): CatalogPolicy {
  return process.env.CATALOG_POLICY?.trim().toLowerCase() === "open" ? "open" : "closed";
}

/** True when the ingest path may not create catalog rows. */
export function isCatalogClosed(): boolean {
  return catalogPolicy() === "closed";
}

/**
 * First candidate name that maps — via the core list itself or the reduction's
 * redirect map — onto a row the caller still holds as ACTIVE, or null.
 *
 * `lookup` is passed in rather than a Map because the two call sites carry
 * different row shapes (clinic-save's `catBySlug`, ingest's flat catalog array),
 * and both need the identical resolution order.
 *
 * Candidates are tried in order, so pass the most specific name first: the AI's
 * `general_name` before the verbatim `raw_name`.
 */
export function coreRowFor<T>(
  kind: "treatment" | "concern",
  candidates: ReadonlyArray<string | null | undefined>,
  lookup: (slug: string) => T | null | undefined
): T | null {
  const toCore = kind === "treatment" ? coreTreatmentFor : coreConcernFor;
  for (const candidate of candidates) {
    const name = candidate?.trim();
    if (!name) continue;
    const slug = toCore(name);
    if (!slug) continue;
    const row = lookup(slug);
    if (row) return row;
  }
  return null;
}
