/**
 * seed-canonical.ts — run with: bun scripts/seed-canonical.ts
 *
 * Seeds the curated canonical taxonomy (src/lib/taxonomy/canonical.ts) into the
 * database:
 *   - every CANONICAL_SERVICES row UPSERTs into `services`
 *     (ON CONFLICT (slug) DO UPDATE all fields incl aliases TEXT[], category,
 *      review_status='approved')
 *   - every CANONICAL_CONCERNS row UPSERTs into `concerns`
 *     (ON CONFLICT (slug) DO UPDATE name)
 *
 * Then verifies that every one of the 56 current messy service names resolves
 * to a canonical slug via matchService().
 */

import pool from "../src/lib/db";
import {
  CANONICAL_SERVICES,
  CANONICAL_CONCERNS,
  matchService,
} from "../src/lib/taxonomy/canonical";

// The 56 current messy scraped service names that MUST all map to a canonical.
const MESSY_NAMES: string[] = [
  "Tox",
  "Botox®",
  "Dysport®",
  "Microneedling",
  "Chemical Peels",
  "Hormone Therapy",
  "Kybella®",
  "Dermal Fillers",
  "Laser Hair Removal",
  "Medical Weight Loss",
  "Facial Treatments",
  "IV Hydration",
  "Morpheus8",
  "PDO Threads",
  "Medical Weight Loss Program",
  "Tattoo Removal",
  "Biological Age Testing",
  "Cosmetic Dentistry",
  "Dermal Fillers & Biostimulators",
  "Dexa Body Scan",
  "EBOO & Ozone Therapy",
  "EBOO/Ozone Therapy",
  "Endolift®",
  "Everesse™ Skin Tightening",
  "Exomind",
  "Full Facial Balancing",
  "Gut Health / Allergy Testing",
  "IncontiLase®",
  "Kybella & Liquid Lipo",
  "Laser Peels",
  "Laser Skin Treatments",
  "Laser Treatments",
  "LichenLase™",
  "Liquid BBL",
  "Medical-Grade Skincare",
  "Men’s Sexual Health",
  "Microneedling / RF Microneedling",
  "MiraDry®",
  "Morpheus8 Treatment",
  "Multi-Cancer Early Detection Screening",
  "NeuroWellness",
  "NightLase®",
  "Peptides",
  "ProlapLase®",
  "RF Microneedling and Microneedling",
  "RUMA Gold Microchannel Treatment",
  "Regenerative Aesthetics (PRP/PRF)",
  "Regenerative Medicine / Joint Therapy",
  "Renuva",
  "Sculptra & Radiesse",
  "Sylfirm X",
  "Sylfirm X RF Microneedling",
  "Vaginal Tightening",
  "Vitamin IV Therapy",
  "Women’s Health",
  "XERF™",
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. UPSERT services ──────────────────────────────────────────────────
    let servicesUpserted = 0;
    for (const svc of CANONICAL_SERVICES) {
      await client.query(
        `
        INSERT INTO services
          (name, slug, category, aliases, summary, description,
           treatment_time, results_timeline, results_duration,
           is_published, review_status, is_active, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'approved', true, NOW())
        ON CONFLICT (slug) DO UPDATE SET
          name             = EXCLUDED.name,
          category         = EXCLUDED.category,
          aliases          = EXCLUDED.aliases,
          summary          = EXCLUDED.summary,
          description      = EXCLUDED.description,
          treatment_time   = EXCLUDED.treatment_time,
          results_timeline = EXCLUDED.results_timeline,
          results_duration = EXCLUDED.results_duration,
          is_published     = EXCLUDED.is_published,
          review_status    = 'approved',
          is_active        = true,
          updated_at       = NOW()
        `,
        [
          svc.name,
          svc.slug,
          svc.category,
          svc.aliases,
          svc.summary,
          svc.description,
          svc.treatment_time,
          svc.results_timeline,
          svc.results_duration,
          svc.is_published,
        ]
      );
      servicesUpserted += 1;
    }

    // ── 2. UPSERT concerns ──────────────────────────────────────────────────
    let concernsUpserted = 0;
    for (const concern of CANONICAL_CONCERNS) {
      await client.query(
        `
        INSERT INTO concerns (name, slug, is_published, is_active, updated_at)
        VALUES ($1, $2, true, true, NOW())
        ON CONFLICT (slug) DO UPDATE SET
          name         = EXCLUDED.name,
          is_published = true,
          is_active    = true,
          updated_at   = NOW()
        `,
        [concern.name, concern.slug]
      );
      concernsUpserted += 1;
    }

    await client.query("COMMIT");

    console.log(`✅ seed-canonical complete`);
    console.log(`   canonical services seeded: ${servicesUpserted}`);
    console.log(`   canonical concerns seeded: ${concernsUpserted}`);

    // ── 3. Verify all 56 messy names resolve via matchService ───────────────
    console.log("");
    console.log(`🔎 resolving ${MESSY_NAMES.length} messy names via matchService:`);
    const unmapped: string[] = [];
    for (const raw of MESSY_NAMES) {
      const { slug, confidence } = matchService(raw);
      if (!slug) {
        unmapped.push(raw);
        console.log(`   ❌ "${raw}" → UNMAPPED (confidence ${confidence.toFixed(2)})`);
      } else {
        const tag = confidence >= 1 ? "matched" : "auto";
        console.log(`   ✓ "${raw}" → ${slug} (${tag} ${confidence.toFixed(2)})`);
      }
    }

    console.log("");
    if (unmapped.length === 0) {
      console.log(`✅ all ${MESSY_NAMES.length} messy names resolved to a canonical slug`);
    } else {
      console.log(`❌ ${unmapped.length} messy name(s) did NOT map: ${unmapped.join(", ")}`);
      process.exit(1);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ seed-canonical failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
