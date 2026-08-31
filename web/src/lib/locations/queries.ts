import { query } from "@/lib/db";

// Per-state aggregations for the /locations/[state] landing pages. Each is
// parameterized by ($1 = 2-letter abbr, $2 = full state name) and reuses the
// search engine's state-filter idiom (cl.state = abbr OR cl.state ILIKE name)
// and its dentistry exclusion, so counts line up with /search. NO pricing.

export interface StateCity {
  city: string;
  clinic_count: number;
}

export interface StateTag {
  slug: string;
  name: string;
  clinic_count: number;
}

/** Distinct cities in the state that have active clinics, busiest first. */
export async function getStateCities(
  abbr: string,
  name: string,
): Promise<StateCity[]> {
  return query<StateCity>(
    `SELECT regexp_replace(cl.city, '[,\\s]+$', '') AS city,
            COUNT(DISTINCT cl.clinic_id)::int AS clinic_count
       FROM clinic_locations cl
       JOIN clinics c ON c.id = cl.clinic_id AND c.is_active = TRUE
      WHERE cl.is_active = TRUE
        AND (cl.state = $1 OR cl.state ILIKE $2)
        AND NULLIF(TRIM(cl.city), '') IS NOT NULL
      GROUP BY regexp_replace(cl.city, '[,\\s]+$', '')
      ORDER BY clinic_count DESC, city`,
    [abbr, name],
  );
}

/** Most-offered treatments across the state's clinics (names only, no pricing). */
export async function getStateTopTreatments(
  abbr: string,
  name: string,
  limit = 12,
): Promise<StateTag[]> {
  return query<StateTag>(
    `SELECT s.slug, s.name, COUNT(DISTINCT cs.clinic_id)::int AS clinic_count
       FROM clinic_services cs
       JOIN services s ON s.id = cs.service_id AND s.is_active = TRUE
         AND s.name !~* '(dentistry|dental|orthodont|veneer)'
       JOIN clinics c ON c.id = cs.clinic_id AND c.is_active = TRUE
      WHERE cs.is_active = TRUE
        AND EXISTS (
          SELECT 1 FROM clinic_locations cl
           WHERE cl.clinic_id = c.id AND cl.is_active = TRUE
             AND (cl.state = $1 OR cl.state ILIKE $2)
        )
      GROUP BY s.slug, s.name
      ORDER BY clinic_count DESC, s.name
      LIMIT $3`,
    [abbr, name, limit],
  );
}

/**
 * Most-treated concerns across the state's clinics. Effective membership =
 * scraped ∪ manual − removed (mirrors the search engine and getEffectiveConcernSlugs).
 */
export async function getStateTopConcerns(
  abbr: string,
  name: string,
  limit = 12,
): Promise<StateTag[]> {
  return query<StateTag>(
    `SELECT con.slug, con.name, COUNT(DISTINCT cc.clinic_id)::int AS clinic_count
       FROM clinic_concerns cc
       JOIN concerns con ON con.id = cc.concern_id AND con.is_active = TRUE
       JOIN clinics c ON c.id = cc.clinic_id AND c.is_active = TRUE
      WHERE cc.is_active = TRUE
        AND cc.source IN ('scraped','manual')
        AND NOT EXISTS (
          SELECT 1 FROM clinic_concerns rem
           WHERE rem.clinic_id = cc.clinic_id AND rem.concern_id = cc.concern_id
             AND rem.is_active = TRUE AND rem.source = 'removed'
        )
        AND EXISTS (
          SELECT 1 FROM clinic_locations cl
           WHERE cl.clinic_id = c.id AND cl.is_active = TRUE
             AND (cl.state = $1 OR cl.state ILIKE $2)
        )
      GROUP BY con.slug, con.name
      ORDER BY clinic_count DESC, con.name
      LIMIT $3`,
    [abbr, name, limit],
  );
}
