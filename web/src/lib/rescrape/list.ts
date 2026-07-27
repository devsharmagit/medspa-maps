/**
 * rescrape/list.ts — enumerate clinics eligible for a scheduled refresh.
 *
 * Eligible = active clinic with a non-empty website, optionally narrowed to ones
 * not refreshed within `staleDays`. Ordered by staleness (least-recently-scraped
 * first) so a partial run still makes progress across the whole DB.
 *
 * `staleDays` is what makes a multi-hour pass restart-safe: because the engine
 * bumps `last_scraped_at` on every ATTEMPT (not only on success), a run that
 * crashes or is redeployed resumes where it stopped instead of starting over —
 * and a permanently-failing clinic can't monopolise the front of the queue.
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
  /** Skip clinics refreshed within this many days. 0 / omitted = no filter. */
  staleDays?: number;
}

const ELIGIBLE_SQL = `is_active = true AND website IS NOT NULL AND btrim(website) <> ''`;
/** NULL last_scraped_at (never refreshed) always qualifies. */
const STALE_SQL = `(last_scraped_at IS NULL OR last_scraped_at < now() - make_interval(days => $1))`;

/** Total number of clinics eligible for refresh (for progress reporting). */
export async function countRescrapeClinics(staleDays = 0): Promise<number> {
  const rows =
    staleDays > 0
      ? await query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM clinics WHERE ${ELIGIBLE_SQL} AND ${STALE_SQL}`,
          [staleDays]
        )
      : await query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM clinics WHERE ${ELIGIBLE_SQL}`
        );
  return Number(rows[0]?.count ?? 0);
}

export async function listRescrapeClinics(
  opts: ListRescrapeClinicsOpts = {}
): Promise<RescrapeClinicRef[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const offset = Math.max(opts.offset ?? 0, 0);
  const staleDays = Math.max(opts.staleDays ?? 0, 0);
  const order = `ORDER BY last_scraped_at ASC NULLS FIRST, created_at ASC`;

  return staleDays > 0
    ? query<RescrapeClinicRef>(
        `SELECT id, name, website, last_scraped_at
           FROM clinics WHERE ${ELIGIBLE_SQL} AND ${STALE_SQL}
          ${order} LIMIT $2 OFFSET $3`,
        [staleDays, limit, offset]
      )
    : query<RescrapeClinicRef>(
        `SELECT id, name, website, last_scraped_at
           FROM clinics WHERE ${ELIGIBLE_SQL}
          ${order} LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
}
