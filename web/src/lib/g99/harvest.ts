/**
 * g99/harvest.ts — match a website domain against the harvested G99 website list
 * (`g99_clinic_websites`, in OUR app DB — not a live G99 prod query).
 *
 * Used by the admin "Add website with AI" flow to attach G99 provenance to a
 * freshly-scraped clinic when its domain is one we harvested from G99.
 */

import { queryOne } from "@/lib/db";
import { websiteDomain } from "@/lib/admin/clinic-save";

export interface G99Attach {
  /** first G99 clinic id for this domain (multi-location domains list several) */
  g99_clinic_id: string | null;
  /** first G99 business id for this domain */
  g99_business_id: string | null;
  /** In G99 the tenant IS the business, so tenant id = business id. */
  g99_tenant_id: string | null;
  business_name: string | null;
  clinic_name: string | null;
}

/**
 * Look up G99 ids for a website/domain. Returns null when the domain isn't in
 * the harvest table or the row carries no ids. `bigint[]` columns come back as
 * `string[]` from pg; we keep them as strings (saveClinicBundle casts `::bigint`).
 */
export async function lookupG99ByDomain(domainOrUrl: string): Promise<G99Attach | null> {
  const dom = websiteDomain(domainOrUrl);
  if (!dom) return null;

  const row = await queryOne<{
    g99_clinic_ids: string[] | null;
    g99_business_ids: string[] | null;
    business_name: string | null;
    clinic_name: string | null;
  }>(
    `SELECT g99_clinic_ids, g99_business_ids, business_name, clinic_name
       FROM g99_clinic_websites WHERE domain = $1`,
    [dom]
  );
  if (!row) return null;

  const clinicId = row.g99_clinic_ids?.[0] ?? null;
  const businessId = row.g99_business_ids?.[0] ?? null;
  if (!clinicId && !businessId) return null;

  return {
    g99_clinic_id: clinicId,
    g99_business_id: businessId,
    g99_tenant_id: businessId,
    business_name: row.business_name,
    clinic_name: row.clinic_name,
  };
}
