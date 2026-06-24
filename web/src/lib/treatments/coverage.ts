/**
 * coverage.ts — Phase-0 priority-treatment coverage for a clinic.
 *
 * Given the canonical service slugs a clinic resolves to (its matched/auto
 * clinic_services), report how many of the 15 priority treatments it offers,
 * which it's missing, and which priority concerns those treatments can treat.
 * Used by the add-clinic flow so an operator can see, at a glance, how well a
 * clinic covers the launch catalog.
 */

import {
  CANONICAL_SERVICES,
  CANONICAL_CONCERNS,
  concernsTreatedBy,
} from "@/lib/taxonomy/canonical";

export interface PriorityTreatment {
  slug: string;
  name: string;
}

export interface PriorityConcern {
  slug: string;
  name: string;
}

export interface PriorityCoverage {
  /** Of the 15 priority treatments, the ones this clinic offers (catalog order). */
  present: PriorityTreatment[];
  /** Of the 15 priority treatments, the ones it doesn't offer (catalog order). */
  missing: PriorityTreatment[];
  /** present.length */
  count: number;
  /** total priority treatments (15) */
  total: number;
  /** Priority concerns treatable by the present treatments (catalog order). */
  concerns: PriorityConcern[];
}

/**
 * computePriorityCoverage(matchedSlugs) — pure; matchedSlugs is the set of
 * canonical service slugs a clinic resolves to. Non-canonical / null slugs are
 * ignored.
 */
export function computePriorityCoverage(
  matchedSlugs: Iterable<string | null | undefined>
): PriorityCoverage {
  const have = new Set(
    [...matchedSlugs].filter((s): s is string => Boolean(s))
  );

  const present: PriorityTreatment[] = [];
  const missing: PriorityTreatment[] = [];
  for (const s of CANONICAL_SERVICES) {
    const item = { slug: s.slug, name: s.name };
    if (have.has(s.slug)) present.push(item);
    else missing.push(item);
  }

  const treatable = new Set(concernsTreatedBy(have));
  const concerns: PriorityConcern[] = CANONICAL_CONCERNS.filter((c) =>
    treatable.has(c.slug)
  ).map((c) => ({ slug: c.slug, name: c.name }));

  return {
    present,
    missing,
    count: present.length,
    total: CANONICAL_SERVICES.length,
    concerns,
  };
}
