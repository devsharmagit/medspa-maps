/**
 * seed-treatments.ts — run with: bun scripts/seed-treatments.ts
 *
 * Seeds the editorial treatment catalog (src/lib/treatments/catalog.ts) into
 * the `services` table, then derives hero stats (rating + review count) for
 * EVERY service from the clinics that offer it.
 *
 * A clinic "offers" a service when it has a clinic_services row whose
 * service_id matches, or whose raw_name matches the service name / any alias.
 *
 * NON-DESTRUCTIVE: only UPDATEs existing service rows; never inserts/deletes.
 */

import pool from "../src/lib/db";
import { TREATMENT_CATALOG } from "../src/lib/treatments/catalog";

async function seed() {
  const client = await pool.connect();
  try {
    // ── 1. Apply editorial catalog to matching service rows ─────────────────
    let updated = 0;
    const skipped: string[] = [];

    for (const entry of TREATMENT_CATALOG) {
      const res = await client.query(
        `
        UPDATE services SET
          summary           = $1,
          description       = $2,
          price_from        = $3,
          price_unit        = $4,
          treatment_time    = $5,
          results_timeline  = $6,
          results_duration  = $7,
          recovery_time     = $8,
          aliases           = $9,
          updated_at        = NOW()
        WHERE slug = $10
        `,
        [
          entry.summary,
          entry.description,
          entry.price_from,
          entry.price_unit,
          entry.treatment_time,
          entry.results_timeline,
          entry.results_duration,
          entry.recovery_time,
          entry.aliases,
          entry.slug,
        ]
      );

      if (res.rowCount && res.rowCount > 0) {
        updated += 1;
        console.log(`✏️  updated  ${entry.slug}`);
      } else {
        skipped.push(entry.slug);
        console.log(`⏭️  skipped  ${entry.slug} (no service row)`);
      }
    }

    // ── 2. Derive hero stats for EVERY service from offering clinics ────────
    // A clinic offers a service if it has a clinic_services row where
    // service_id matches, OR raw_name ILIKE the service name, OR raw_name
    // ILIKE any of the service's aliases.
    const heroRes = await client.query(`
      WITH offering AS (
        SELECT DISTINCT s.id AS service_id, c.id AS clinic_id,
               c.avg_rating, c.review_count
        FROM services s
        JOIN clinic_services cs
          ON cs.service_id = s.id
          OR cs.raw_name ILIKE '%' || s.name || '%'
          OR cs.raw_name ILIKE ANY (
               SELECT '%' || a || '%' FROM unnest(COALESCE(s.aliases, '{}')) AS a
             )
        JOIN clinics c ON c.id = cs.clinic_id
      )
      UPDATE services s SET
        hero_rating = stats.hero_rating,
        hero_review_count = stats.hero_review_count,
        updated_at = NOW()
      FROM (
        SELECT service_id,
               ROUND(AVG(avg_rating) FILTER (WHERE avg_rating IS NOT NULL), 2) AS hero_rating,
               SUM(review_count) AS hero_review_count
        FROM offering
        GROUP BY service_id
      ) AS stats
      WHERE s.id = stats.service_id
    `);

    console.log("");
    console.log(`📊 hero stats computed for ${heroRes.rowCount} services`);

    // ── 3. Report ──────────────────────────────────────────────────────────
    const botox = await client.query(
      `SELECT hero_rating, hero_review_count FROM services WHERE slug = 'botox'`
    );
    const botoxRow = botox.rows[0];

    console.log("");
    console.log(`✅ seed-treatments complete`);
    console.log(`   catalog entries updated: ${updated}`);
    console.log(`   catalog entries skipped: ${skipped.length}${skipped.length ? ` (${skipped.join(", ")})` : ""}`);
    console.log(
      `   botox hero_rating: ${botoxRow?.hero_rating ?? "null"}, hero_review_count: ${botoxRow?.hero_review_count ?? "null"}`
    );
  } catch (err) {
    console.error("❌ seed-treatments failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
