import pool from "@/lib/db";

export interface TreatmentListItem {
  slug: string;
  name: string;
  clinic_count: number;
}

/**
 * List of treatments for the /treatments index. The services catalog is now
 * name/slug only, so each row is a treatment name + a live clinic count. Rows
 * offered by no clinic are dropped (stray scraped anchor text). Highest coverage
 * first, then alphabetical.
 */
export async function listTreatments(): Promise<TreatmentListItem[]> {
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT
         s.slug, s.name,
         (
           SELECT count(DISTINCT cl.id)::int
           FROM clinic_services cs
           JOIN clinics cl ON cl.id = cs.clinic_id AND cl.is_active = true
           WHERE cs.is_active = true
             AND (cs.service_id = s.id
                  OR cs.raw_name ILIKE '%' || regexp_replace(s.name, '[®™]', '', 'g') || '%')
         ) AS clinic_count
       FROM services s
       WHERE s.is_active = true
     ) t
     WHERE t.clinic_count > 0
     ORDER BY t.clinic_count DESC, t.name`
  );
  return rows as TreatmentListItem[];
}
