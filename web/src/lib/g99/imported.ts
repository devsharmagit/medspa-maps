/**
 * g99/imported.ts — cross-reference G99 clinics against our own DB to decide
 * what's already been imported.
 *
 * Two signals, in priority order:
 *   1. HARD LINK  — our `clinics.g99_clinic_id` equals the G99 clinic id. This
 *      is set when a clinic is imported through this feature; it's exact.
 *   2. DOMAIN MATCH — our `clinics.website` resolves to the same host as the
 *      G99 clinic's website. A softer signal (G99 test data reuses domains like
 *      `ruma.com`), surfaced separately so the admin can judge.
 */

import { query } from "@/lib/db";
import { websiteDomain } from "@/lib/admin/clinic-save";

export type ImportState = "imported" | "domain-match" | "new";

export interface ImportedInfo {
  state: ImportState;
  /** our clinic id (when imported / domain-match), else null */
  clinicId: string | null;
  slug: string | null;
}

const NEW: ImportedInfo = { state: "new", clinicId: null, slug: null };

/**
 * Build a Map<g99ClinicId, ImportedInfo> for the given G99 clinics.
 * One query for the hard links, one for the domain index.
 */
export async function importedStatusFor(
  clinics: { clinic_id: string; website: string | null }[]
): Promise<Map<string, ImportedInfo>> {
  const result = new Map<string, ImportedInfo>();
  if (clinics.length === 0) return result;

  const g99Ids = clinics.map((c) => c.clinic_id);

  // 1. hard links by g99_clinic_id
  const hard = await query<{ g99_clinic_id: string; id: string; slug: string }>(
    `SELECT g99_clinic_id::text AS g99_clinic_id, id, slug
       FROM clinics
      WHERE g99_clinic_id = ANY($1::bigint[])`,
    [g99Ids]
  );
  const byG99 = new Map(hard.map((r) => [r.g99_clinic_id, r]));

  // 2. domain index across all our clinics with a website
  const ours = await query<{ id: string; slug: string; website: string | null }>(
    `SELECT id, slug, website FROM clinics WHERE website IS NOT NULL AND TRIM(website) <> ''`
  );
  const byDomain = new Map<string, { id: string; slug: string }>();
  for (const c of ours) {
    if (!c.website) continue;
    const d = websiteDomain(c.website);
    if (d && !byDomain.has(d)) byDomain.set(d, { id: c.id, slug: c.slug });
  }

  for (const c of clinics) {
    const hardHit = byG99.get(c.clinic_id);
    if (hardHit) {
      result.set(c.clinic_id, { state: "imported", clinicId: hardHit.id, slug: hardHit.slug });
      continue;
    }
    const domain = c.website ? websiteDomain(c.website) : "";
    const domHit = domain ? byDomain.get(domain) : undefined;
    if (domHit) {
      result.set(c.clinic_id, { state: "domain-match", clinicId: domHit.id, slug: domHit.slug });
      continue;
    }
    result.set(c.clinic_id, NEW);
  }

  return result;
}
