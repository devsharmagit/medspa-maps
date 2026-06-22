/**
 * geocode-clinics.ts — run with: bun scripts/geocode-clinics.ts
 *
 * Best-effort backfill of lat/lng (and the PostGIS `geo` column) for active
 * clinics that are missing coordinates, so more of them show up in radius
 * search.
 *
 * Strategy:
 *   1. Select active clinics WHERE lat IS NULL OR lng IS NULL, that have at
 *      least an address (or city) plus enough to form a meaningful query.
 *   2. Build a "address, city, state zip" string and pass it to
 *      geocodeAddress() (Nominatim, US-only, internally rate-limited).
 *   3. For any that resolve, UPDATE lat/lng and set geo via
 *      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography.
 *
 * Notes:
 *   - geocodeAddress() never throws and returns null on failure, so junk
 *     addresses, non-US (Canada/India) rows, and an unconfigured/unreachable
 *     geocoder all simply resolve to "no result" rather than aborting the run.
 *   - Capped at MAX_CLINICS and rate-limited (the geocoder enforces ~1 req/s)
 *     to stay within Nominatim's usage policy.
 *
 * Idempotent: only touches rows still missing coords, safe to re-run.
 */

import { geocodeAddress } from "../src/lib/geocoder";
import pool from "../src/lib/db";

const q = (sql: string, params?: unknown[]) => pool.query(sql, params);

/** Safety cap so a single run never hammers the geocoder. */
const MAX_CLINICS = 40;
/** Small extra pause between clinics on top of the geocoder's own rate limit. */
const DELAY_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Build the most complete address query we can from the available parts. */
function buildQuery(c: {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}): string {
  // Prefer the structured parts; fall back to the raw address line.
  const tail = [c.city, c.state].filter(Boolean).join(", ");
  const parts: string[] = [];
  if (c.address) parts.push(c.address.trim());
  if (tail) parts.push(tail);
  if (c.zip) parts.push(c.zip.trim());
  // De-dupe the case where the raw address already contains city/state/zip.
  const query = parts.join(", ");
  return query;
}

async function main() {
  console.log("📍 Geocoding active clinics missing coordinates...");

  const { rows: candidates } = await q(
    `SELECT id, name, address, city, state, zip
       FROM clinics
      WHERE is_active = true
        AND (lat IS NULL OR lng IS NULL)
        AND (address IS NOT NULL OR city IS NOT NULL)
      ORDER BY
        -- prioritise rows that look like real, geocodable addresses
        (city IS NOT NULL AND state IS NOT NULL) DESC,
        name
      LIMIT $1`,
    [MAX_CLINICS]
  );

  console.log(`  ${candidates.length} candidate(s) (capped at ${MAX_CLINICS})`);

  let geocoded = 0;
  let unavailableSignals = 0;

  for (const c of candidates) {
    const query = buildQuery(c);
    if (!query || query.trim().length < 5) {
      console.log(`  – ${c.name}: query too short ("${query}") — skipped`);
      continue;
    }

    let result = null;
    try {
      result = await geocodeAddress(query);
    } catch (err) {
      // geocodeAddress is documented not to throw, but guard anyway so an
      // auth/network failure is logged rather than aborting the whole run.
      unavailableSignals++;
      console.warn(
        `  ! ${c.name}: geocoder error —`,
        err instanceof Error ? err.message : err
      );
      await sleep(DELAY_MS);
      continue;
    }

    if (!result) {
      console.log(`  – ${c.name}: no result for "${query}"`);
      await sleep(DELAY_MS);
      continue;
    }

    await q(
      `UPDATE clinics SET
         lat = $2::float8::numeric,
         lng = $3::float8::numeric,
         geo = ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography,
         updated_at = NOW()
       WHERE id = $1`,
      [c.id, result.lat, result.lng]
    );
    geocoded++;
    console.log(
      `  ✓ ${c.name}: ${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}`
    );

    await sleep(DELAY_MS);
  }

  // ── report ──────────────────────────────────────────────────────────────
  const { rows: tot } = await q(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL)::int AS with_coords
       FROM clinics WHERE is_active = true`
  );
  const { total, with_coords } = tot[0];

  console.log(`\n✅ Done.`);
  console.log(`   newly geocoded:        ${geocoded}`);
  console.log(`   active clinics:        ${total}`);
  console.log(`   active with coords:    ${with_coords}`);

  if (geocoded === 0 && candidates.length > 0) {
    console.log(
      `\n⚠️  Geocoded 0 of ${candidates.length} candidates. This is likely ` +
        `because the remaining addresses are junk/non-US, OR the geocoder is ` +
        `unavailable (${unavailableSignals} error(s) seen). Treating as ` +
        `non-blocking.`
    );
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error("❌ geocode-clinics failed:", e);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
