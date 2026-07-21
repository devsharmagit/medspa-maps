import pool from "@/lib/db";

/**
 * Concern → treatment associations, derived by CO-OCCURRENCE across the two
 * reliable joins only: `clinic_concerns` (clinic ⇄ concern) and
 * `clinic_services` (clinic ⇄ treatment). For each concern we take the services
 * most often offered by the clinics that treat that concern.
 *
 * We deliberately do NOT use `clinic_service_concerns` (written by ingest but
 * stale/unread), and we compute this ONCE and cache it for the process lifetime
 * (refreshed at most daily) — it is a soft grounding signal for the AI prompt,
 * not per-request data.
 */

export type ConcernTreatmentMap = Record<
  string,
  { slug: string; name: string }[]
>;

const REFRESH_MS = 24 * 60 * 60 * 1000; // at most once a day
const TOP_PER_CONCERN = 6;

let cache: ConcernTreatmentMap | null = null;
let cachedAt = 0;
let inflight: Promise<ConcernTreatmentMap> | null = null;

async function build(): Promise<ConcernTreatmentMap> {
  const { rows } = await pool.query<{
    concern_slug: string;
    service_slug: string;
    service_name: string;
  }>(
    `
    WITH ranked AS (
      SELECT
        co.slug AS concern_slug,
        s.slug  AS service_slug,
        s.name  AS service_name,
        COUNT(DISTINCT cc.clinic_id) AS clinic_count,
        ROW_NUMBER() OVER (
          PARTITION BY co.slug
          ORDER BY COUNT(DISTINCT cc.clinic_id) DESC, s.name
        ) AS rn
      FROM clinic_concerns cc
      JOIN concerns co ON co.id = cc.concern_id AND co.is_active = true
      JOIN clinic_services cs
        ON cs.clinic_id = cc.clinic_id AND cs.is_active = true
      JOIN services s ON s.id = cs.service_id
        AND s.is_active = true
        AND s.name !~* '(dentistry|dental|orthodont|veneer)'
      WHERE cc.is_active = true
        AND cc.source IN ('scraped', 'manual')
      GROUP BY co.slug, s.slug, s.name
    )
    SELECT concern_slug, service_slug, service_name
    FROM ranked
    WHERE rn <= $1
    ORDER BY concern_slug, rn
    `,
    [TOP_PER_CONCERN]
  );

  const map: ConcernTreatmentMap = {};
  for (const row of rows) {
    (map[row.concern_slug] ??= []).push({
      slug: row.service_slug,
      name: row.service_name,
    });
  }
  return map;
}

/** Cached concern→treatment map. Built once, refreshed at most daily. */
export async function getConcernTreatmentMap(): Promise<ConcernTreatmentMap> {
  const now = Date.now();
  if (cache && now - cachedAt < REFRESH_MS) return cache;
  if (inflight) return inflight;
  inflight = build()
    .then((map) => {
      cache = map;
      cachedAt = Date.now();
      return map;
    })
    .catch((err) => {
      // On failure, fall back to whatever we had (or empty) — grounding is a
      // soft nudge and must never break analysis.
      console.warn("[skin-navigator] association map build failed:", err);
      return cache ?? {};
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
