/**
 * scripts/backfill-place-ids.ts — fill google_place_id (and coords, if missing)
 * for the handful of active locations still lacking a place_id, via Google
 * Places searchText by name + address. Complements fix-clinic-maps.ts (which
 * only stored place_id on locations it resolved through Places).
 *
 * Writes ONLY: google_place_id, and lat/lng/geo when currently null. Never
 * overwrites an existing address, link, or coordinates. A Places hit is
 * rejected when it's demonstrably a different place (known-far AND zip-mismatch).
 *
 *   bun scripts/backfill-place-ids.ts            # preview (no writes)
 *   bun scripts/backfill-place-ids.ts --apply    # write
 */
import "dotenv/config";
import pool, { query, withTransaction } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");
const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACE_API_KEY;
const COORD_MISMATCH_KM = 25;

interface Loc {
  id: string; name: string; slug: string;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  lat: number | null; lng: number | null;
}
interface Hit { placeId: string | null; lat: number | null; lng: number | null; address: string | null; }

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function placesLookup(text: string): Promise<Hit | null> {
  if (!KEY) return null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": "places.id,places.location,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: Array<{ id?: string; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }> };
    const p = data.places?.[0];
    if (!p?.id) return null;
    return { placeId: p.id, lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null, address: p.formattedAddress ?? null };
  } catch { return null; }
}

async function main() {
  if (!KEY) { console.error("No GOOGLE_PLACE_API_KEY set."); process.exit(1); }
  const locs = await query<Loc>(
    `SELECT cl.id, c.name, c.slug, cl.address, cl.city, cl.state, cl.zip, cl.lat::float8 lat, cl.lng::float8 lng
       FROM clinic_locations cl JOIN clinics c ON c.id = cl.clinic_id
      WHERE cl.is_active = true AND (cl.google_place_id IS NULL OR length(cl.google_place_id) = 0)
      ORDER BY c.name`
  );
  console.log(`${APPLY ? "APPLY" : "PREVIEW"} — ${locs.length} location(s) missing place_id\n`);

  let set = 0, coords = 0, rejected = 0, nohit = 0;
  for (const l of locs) {
    const q = [l.name, l.address, [l.city, l.state].filter(Boolean).join(" "), l.zip].filter(Boolean).join(", ");
    const hit = await placesLookup(q);
    if (!hit) { nohit++; console.log(`  ✗ ${l.name} — no Places hit`); continue; }

    // Trust gate: reject only if we KNOW it's a different place (far + zip mismatch).
    const zipOk = !!(l.zip && hit.address?.includes(l.zip));
    const far = hit.lat != null && hit.lng != null && l.lat != null && l.lng != null &&
      haversineKm(hit.lat, hit.lng, l.lat, l.lng) > COORD_MISMATCH_KM;
    if (far && !zipOk) { rejected++; console.log(`  · ${l.name} — Places hit rejected (far + zip mismatch), kept as-is`); continue; }

    const fillCoords = (l.lat == null || l.lng == null) && hit.lat != null && hit.lng != null;
    console.log(`  ✓ ${l.name} — place_id ${hit.placeId}${fillCoords ? ` + coords ${hit.lat!.toFixed(4)},${hit.lng!.toFixed(4)}` : ""}`);
    set++; if (fillCoords) coords++;

    if (APPLY) {
      await withTransaction(async (client) => {
        await client.query(`UPDATE clinic_locations SET google_place_id = $2, updated_at = now() WHERE id = $1`, [l.id, hit.placeId]);
        if (fillCoords) {
          await client.query(
            `UPDATE clinic_locations
                SET lat = $2, lng = $3,
                    geo = ST_SetSRID(ST_MakePoint($4::float8, $5::float8), 4326)::geography
              WHERE id = $1`,
            [l.id, hit.lat, hit.lng, hit.lng, hit.lat]
          );
        }
      });
    }
  }

  console.log(`\n──────── summary ────────`);
  console.log(`place_id set:   ${set}`);
  console.log(`coords filled:  ${coords}`);
  console.log(`rejected/kept:  ${rejected}`);
  console.log(`no Places hit:  ${nohit}`);
  if (!APPLY) console.log(`\n(preview only — re-run with --apply to write)`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
