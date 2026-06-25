/**
 * fix-multilocation-clinics.ts — run with: bun scripts/fix-multilocation-clinics.ts
 *
 * Fixes the "RajShree – Boston / RajShree – New York" anti-pattern where
 * multi-location clinics were stored as separate clinic rows.
 *
 * What it does:
 *  1. For each business with 2+ clinics whose names match "{bizName} – {city}":
 *     a. Keep the OLDEST clinic as the survivor, rename it to just "{bizName}"
 *     b. Insert a clinic_locations row for every sibling's address
 *     c. Reassign clinic_services, images, and reviews from siblings → survivor
 *     d. Delete the now-empty sibling clinic rows
 *  2. For every clinic that has address data but no clinic_locations rows yet:
 *     backfill a single is_primary=TRUE location row.
 *
 * Run with --dry-run to preview changes without touching the DB.
 * Run without flags to apply changes (with full rollback on error).
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: false },
});

interface ClinicRow {
  id: string;
  name: string;
  business_id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  zip: string | null;
  lat: string | null;
  lng: string | null;
  phone: string | null;
  email: string | null;
  booking_url: string | null;
  google_maps_url: string | null;
  google_place_id: string | null;
  hours: unknown;
  created_at: string;
}

async function run() {
  const client = await pool.connect();

  console.log(DRY_RUN ? "🔍 DRY RUN — no changes will be written\n" : "🚀 LIVE RUN\n");

  try {
    if (!DRY_RUN) await client.query("BEGIN");

    // ── 1. Find all clinics with the em-dash city pattern ────────────────────
    const allClinics = await client.query<ClinicRow>(`
      SELECT
        c.id, c.name, c.business_id, b.name AS business_name,
        c.city, c.state, c.address, c.zip,
        c.lat::text, c.lng::text,
        c.phone, c.email, c.booking_url, c.google_maps_url, c.google_place_id,
        c.hours, c.created_at
      FROM clinics c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.is_active = true
      ORDER BY c.business_id, c.created_at ASC
    `);

    // Group by business_id
    const byBusiness = new Map<string, ClinicRow[]>();
    for (const row of allClinics.rows) {
      const list = byBusiness.get(row.business_id) ?? [];
      list.push(row);
      byBusiness.set(row.business_id, list);
    }

    let mergedGroups = 0;
    let mergedClinics = 0;
    let backfilled = 0;

    for (const [bizId, clinics] of byBusiness) {
      // Detect the multi-location anti-pattern: all clinics in this business
      // have names like "{bizName} – {something}"
      const bizName = clinics[0].business_name;
      const emDashPattern = new RegExp(`^${escapeRegex(bizName)}\\s*[–—-]\\s*.+$`);
      const multiLocClinics = clinics.filter((c) => emDashPattern.test(c.name));

      if (multiLocClinics.length >= 2) {
        // ── MERGE GROUP ─────────────────────────────────────────────────────
        const [survivor, ...siblings] = multiLocClinics; // oldest first (ORDER BY created_at ASC)
        const cleanName = bizName.trim();

        console.log(`\n📦 Merging business "${bizName}" (id: ${bizId})`);
        console.log(`  ✅ Survivor: "${survivor.name}" (${survivor.id})`);
        console.log(`  ⚠️  Rename to: "${cleanName}"`);
        for (const s of siblings) console.log(`  🗑  Sibling: "${s.name}" (${s.id})`);

        if (!DRY_RUN) {
          // Rename survivor
          await client.query(
            `UPDATE clinics SET name = $1, updated_at = NOW() WHERE id = $2`,
            [cleanName, survivor.id]
          );
        }

        // Insert clinic_locations for survivor (is_primary = TRUE)
        await insertLocationIfMissing(client, survivor, true, DRY_RUN);

        // Insert clinic_locations for each sibling, then migrate their data
        for (let i = 0; i < siblings.length; i++) {
          const sib = siblings[i];

          // Ensure no existing clinic_locations for this sibling first
          await insertLocationIfMissing(client, sib, false, DRY_RUN, survivor.id);

          if (!DRY_RUN) {
            // Migrate clinic_services (dedup by raw_name)
            await client.query(`
              INSERT INTO clinic_services
                (clinic_id, service_id, raw_name, description, match_status,
                 match_confidence, data_source, scraped_from_url, last_scraped_at)
              SELECT
                $1, service_id, raw_name, description, match_status,
                match_confidence, data_source, scraped_from_url, last_scraped_at
              FROM clinic_services
              WHERE clinic_id = $2
              ON CONFLICT (clinic_id, raw_name) DO NOTHING
            `, [survivor.id, sib.id]);

            // Migrate images: delete duplicates first, then reassign the rest
            await client.query(`
              DELETE FROM images
              WHERE entity_type = 'clinic' AND entity_id = $1
                AND source_url IN (
                  SELECT source_url FROM images
                  WHERE entity_type = 'clinic' AND entity_id = $2
                )
            `, [sib.id, survivor.id]);
            await client.query(`
              UPDATE images
              SET entity_id = $1, updated_at = NOW()
              WHERE entity_type = 'clinic' AND entity_id = $2
            `, [survivor.id, sib.id]);

            // Migrate reviews
            await client.query(`
              UPDATE reviews SET clinic_id = $1 WHERE clinic_id = $2
            `, [survivor.id, sib.id]);

            // Soft-delete sibling clinic
            await client.query(`
              UPDATE clinics SET is_active = false, updated_at = NOW() WHERE id = $1
            `, [sib.id]);
          }

          mergedClinics++;
        }

        mergedGroups++;
      } else {
        // ── BACKFILL single-location clinics ────────────────────────────────
        for (const clinic of clinics) {
          const hasLocation = await client.query(
            `SELECT id FROM clinic_locations WHERE clinic_id = $1 LIMIT 1`,
            [clinic.id]
          );
          if (hasLocation.rows.length === 0) {
            if (clinic.address || clinic.city || clinic.lat) {
              console.log(`  📍 Backfill location for: "${clinic.name}" (${clinic.id})`);
              await insertLocationIfMissing(client, clinic, true, DRY_RUN);
              backfilled++;
            }
          }
        }
      }
    }

    if (!DRY_RUN) await client.query("COMMIT");

    console.log("\n─────────────────────────────────────────");
    console.log(`  Businesses merged:       ${mergedGroups}`);
    console.log(`  Sibling clinics removed: ${mergedClinics}`);
    console.log(`  Single-location backfilled: ${backfilled}`);
    console.log(DRY_RUN ? "\n🔍 DRY RUN complete — nothing written" : "\n✅ Done — data fixed");
  } catch (err) {
    if (!DRY_RUN) await client.query("ROLLBACK");
    console.error("❌ Failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function insertLocationIfMissing(
  client: any,
  clinic: ClinicRow,
  isPrimary: boolean,
  dryRun: boolean,
  overrideClinicId?: string // when merging siblings, write to survivor's clinic_id
) {
  const targetClinicId = overrideClinicId ?? clinic.id;

  // Only insert if address data exists
  if (!clinic.address && !clinic.city && !clinic.lat) return;

  if (dryRun) {
    console.log(
      `    [DRY] Insert clinic_locations: clinic_id=${targetClinicId} city=${clinic.city} is_primary=${isPrimary}`
    );
    return;
  }

  const lat = clinic.lat ? parseFloat(clinic.lat) : null;
  const lng = clinic.lng ? parseFloat(clinic.lng) : null;

  await client.query(
    `INSERT INTO clinic_locations
       (clinic_id, label, address, city, state, zip, lat, lng, phone, email,
        booking_url, google_maps_url, google_place_id, hours, is_primary, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)
     ON CONFLICT DO NOTHING`,
    [
      targetClinicId,
      clinic.city ?? null,
      clinic.address ?? null,
      clinic.city ?? null,
      clinic.state ?? null,
      clinic.zip ?? null,
      lat,
      lng,
      clinic.phone ?? null,
      clinic.email ?? null,
      clinic.booking_url ?? null,
      clinic.google_maps_url ?? null,
      clinic.google_place_id ?? null,
      clinic.hours ? JSON.stringify(clinic.hours) : null,
      isPrimary,
      0,
    ]
  );

  // Update geo if lat/lng present
  if (lat != null && lng != null) {
    try {
      await client.query(
        `UPDATE clinic_locations
            SET geo = ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography
          WHERE clinic_id = $3 AND city = $4 AND geo IS NULL`,
        [lat, lng, targetClinicId, clinic.city ?? ""]
      );
    } catch {
      // PostGIS may not be available
    }
  }
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

run();
