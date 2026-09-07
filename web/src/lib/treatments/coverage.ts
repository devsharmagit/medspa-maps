/**
 * coverage.ts — core-catalog coverage for a clinic.
 *
 * Given the service slugs a clinic resolves to (its matched/auto
 * clinic_services), report how many of the core treatments it offers, which
 * it's missing, and which core concerns those treatments can treat. Used by the
 * add-clinic flow so an operator can see at a glance how well a clinic covers
 * the public catalog.
 *
 * The denominator moved from the 15 Phase-0 CANONICAL_SERVICES to the 19 core
 * treatments on 2026-09-06. It has to: after the reduction those are the only
 * treatments the site can surface, so "12/15" would have been measuring against
 * a list that no longer exists — and it counted PDO Threads and Ultherapy,
 * which are now invisible to users, while ignoring Dysport and Lip Fillers,
 * which are not.
 */

import { concernsTreatedBy } from "@/lib/taxonomy/canonical";
import { CORE_TREATMENTS, CORE_CONCERNS, coreConcernFor } from "@/lib/taxonomy/core-catalog";

export interface PriorityTreatment {
  slug: string;
  name: string;
}

export interface PriorityConcern {
  slug: string;
  name: string;
}

export interface PriorityCoverage {
  /** Of the core treatments, the ones this clinic offers (catalog order). */
  present: PriorityTreatment[];
  /** Of the core treatments, the ones it doesn't offer (catalog order). */
  missing: PriorityTreatment[];
  /** present.length */
  count: number;
  /** total core treatments (19) */
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
  for (const s of CORE_TREATMENTS) {
    const item = { slug: s.slug, name: s.name };
    if (have.has(s.slug)) present.push(item);
    else missing.push(item);
  }

  // concernsTreatedBy still speaks the old CANONICAL_CONCERNS vocabulary, so
  // map its output onto core slugs before intersecting.
  const treatable = new Set(
    [...concernsTreatedBy(have)].map((slug) => coreConcernFor(slug)).filter((s): s is string => s !== null)
  );
  const concerns: PriorityConcern[] = CORE_CONCERNS.filter((c) =>
    treatable.has(c.slug)
  ).map((c) => ({ slug: c.slug, name: c.name }));

  return {
    present,
    missing,
    count: present.length,
    total: CORE_TREATMENTS.length,
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
  /** total core treatments (19) */
  treatmentTotal: number;
  /** Priority concerns explicitly selected (catalog order). */
  presentConcerns: PriorityConcern[];
  /** Priority concerns not currently selected (catalog order). */
  missingConcerns: PriorityConcern[];
  /** presentConcerns.length */
  concernCount: number;
  /** total core concerns (14) */
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
  for (const s of CORE_TREATMENTS) {
    const item = { slug: s.slug, name: s.name };
    if (haveTreatments.has(s.slug)) presentTreatments.push(item);
    else missingTreatments.push(item);
  }

  const presentConcerns: PriorityConcern[] = [];
  const missingConcerns: PriorityConcern[] = [];
  for (const c of CORE_CONCERNS) {
    const item = { slug: c.slug, name: c.name };
    if (haveConcerns.has(c.slug)) presentConcerns.push(item);
    else missingConcerns.push(item);
  }

  return {
    presentTreatments,
    missingTreatments,
    treatmentCount: presentTreatments.length,
    treatmentTotal: CORE_TREATMENTS.length,
    presentConcerns,
    missingConcerns,
    concernCount: presentConcerns.length,
    concernTotal: CORE_CONCERNS.length,
  };
}
