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

export interface EditableCoverage {
  /** Priority treatments this clinic offers (catalog order). */
  presentTreatments: PriorityTreatment[];
  /** Priority treatments it doesn't offer (catalog order). */
  missingTreatments: PriorityTreatment[];
  /** presentTreatments.length */
  treatmentCount: number;
  /** total priority treatments (15) */
  treatmentTotal: number;
  /** Priority concerns explicitly selected (catalog order). */
  presentConcerns: PriorityConcern[];
  /** Priority concerns not currently selected (catalog order). */
  missingConcerns: PriorityConcern[];
  /** presentConcerns.length */
  concernCount: number;
  /** total priority concerns (10) */
  concernTotal: number;
}

/**
 * computeEditableCoverage(treatmentSlugs, concernSlugs) — pure. Unlike
 * computePriorityCoverage, the concern section reflects the admin's EXPLICIT
 * selection (concernSlugs) rather than the auto-derived treatable set, so
 * treatments and concerns can be edited independently. Non-canonical / null
 * slugs are ignored.
 */
export function computeEditableCoverage(
  treatmentSlugs: Iterable<string | null | undefined>,
  concernSlugs: Iterable<string | null | undefined>
): EditableCoverage {
  const haveTreatments = new Set(
    [...treatmentSlugs].filter((s): s is string => Boolean(s))
  );
  const haveConcerns = new Set(
    [...concernSlugs].filter((s): s is string => Boolean(s))
  );

  const presentTreatments: PriorityTreatment[] = [];
  const missingTreatments: PriorityTreatment[] = [];
  for (const s of CANONICAL_SERVICES) {
    const item = { slug: s.slug, name: s.name };
    if (haveTreatments.has(s.slug)) presentTreatments.push(item);
    else missingTreatments.push(item);
  }

  const presentConcerns: PriorityConcern[] = [];
  const missingConcerns: PriorityConcern[] = [];
  for (const c of CANONICAL_CONCERNS) {
    const item = { slug: c.slug, name: c.name };
    if (haveConcerns.has(c.slug)) presentConcerns.push(item);
    else missingConcerns.push(item);
  }

  return {
    presentTreatments,
    missingTreatments,
    treatmentCount: presentTreatments.length,
    treatmentTotal: CANONICAL_SERVICES.length,
    presentConcerns,
    missingConcerns,
    concernCount: presentConcerns.length,
    concernTotal: CANONICAL_CONCERNS.length,
  };
}
