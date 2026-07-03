/**
 * rescrape/list.ts — enumerate clinics eligible for the daily re-scrape.
 *
 * Eligible = active clinic with a non-empty website. Ordered by staleness
 * (least-recently-scraped first) so a partial run still makes progress across
 * the whole DB over successive days/batches.
 */

import { query } from "@/lib/db";

export interface RescrapeClinicRef {
  id: string;
  name: string;
  website: string;
  last_scraped_at: string | null;
}

export interface ListRescrapeClinicsOpts {
  limit?: number;
  offset?: number;
}

/** Total number of clinics eligible for re-scrape (for progress reporting). */
export async function countRescrapeClinics(): Promise<number> {
  const row = (
    await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM clinics
        WHERE is_active = true AND website IS NOT NULL AND btrim(website) <> ''`
    )
  )[0];
  return Number(row?.count ?? 0);
}

export async function listRescrapeClinics(
  opts: ListRescrapeClinicsOpts = {}
): Promise<RescrapeClinicRef[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const offset = Math.max(opts.offset ?? 0, 0);
  return query<RescrapeClinicRef>(
    `SELECT id, name, website, last_scraped_at
       FROM clinics
      WHERE is_active = true AND website IS NOT NULL AND btrim(website) <> ''
      ORDER BY last_scraped_at ASC NULLS FIRST, created_at ASC
      LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}
