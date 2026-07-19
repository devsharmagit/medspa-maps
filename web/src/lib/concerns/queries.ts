import pool from "@/lib/db";

export interface ConcernListItem {
  slug: string;
  name: string;
  is_active: boolean;
}

/** List of active concerns (name + slug). */
export async function listConcerns(): Promise<ConcernListItem[]> {
  const { rows } = await pool.query(
    `SELECT c.slug, c.name, c.is_active
       FROM concerns c
      WHERE c.is_active = true
      ORDER BY c.name`
  );
  return rows as ConcernListItem[];
}
