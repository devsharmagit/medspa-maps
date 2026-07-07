/**
 * geocode-backfill.ts — fill lat/lng/geo for clinic_locations that have an
 * address but no coordinates (e.g. Nominatim throttled during ingest), then sync
 * each clinic's own geo from its primary/any geocoded location. No AI cost.
 *
 *   bun scripts/geocode-backfill.ts
 */

import pool, { query } from "../src/lib/db";
import { geocodeAddress } from "../src/lib/geocoder";

async function main() {
  const locs = await query<{
    id: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  }>(
    `SELECT id, address, city, state, zip
       FROM clinic_locations
      WHERE geo IS NULL AND (address IS NOT NULL OR city IS NOT NULL)`
  );
  console.log(`→ geocoding ${locs.length} locations missing coordinates …`);

  let filled = 0;
  for (const l of locs) {
    const q = [l.address, l.city, l.state, l.zip]
      .map((p) => (p ? String(p).trim() : ""))
      .filter(Boolean)
      .join(", ");
    if (q.length < 5) continue;
    const geo = await geocodeAddress(q);
    if (geo) {
      await query(
        `UPDATE clinic_locations
            SET lat = $2::float8::numeric, lng = $3::float8::numeric,
                geo = ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography
          WHERE id = $1`,
        [l.id, geo.lat, geo.lng]
      );
      filled++;
    }
  }

  // Sync each clinic's own geo from its primary (or any) geocoded location.
  await query(`
    UPDATE clinics c
       SET lat = sub.lat, lng = sub.lng, geo = sub.geo, updated_at = NOW()
      FROM (
        SELECT DISTINCT ON (clinic_id) clinic_id, lat, lng, geo
          FROM clinic_locations
         WHERE geo IS NOT NULL
         ORDER BY clinic_id, is_primary DESC, sort_order
      ) sub
     WHERE sub.clinic_id = c.id AND c.geo IS NULL
  `);

  await query("REFRESH MATERIALIZED VIEW public.clinic_search_view");

  const [{ loc_geo, clinic_geo }] = await query<{ loc_geo: number; clinic_geo: number }>(
    `SELECT (SELECT count(*)::int FROM clinic_locations WHERE geo IS NOT NULL) AS loc_geo,
            (SELECT count(*)::int FROM clinics WHERE geo IS NOT NULL) AS clinic_geo`
  );
  console.log(`✓ backfilled ${filled} locations. geocoded now: ${loc_geo} locations, ${clinic_geo} clinics.`);

  await pool.end();
}

main().catch(async (err) => {
  console.error("✗ backfill failed:", err);
  await pool.end();
  process.exit(1);
});
