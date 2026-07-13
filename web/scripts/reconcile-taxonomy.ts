/**
 * reconcile-taxonomy.ts — run with: bun scripts/reconcile-taxonomy.ts
 *
 * Reconciles the database to the Phase-0 priority taxonomy (15 treatments,
 * 10 conditions). Destructive but idempotent, wrapped in one transaction:
 *
 *   1. UPSERT the 15 canonical services (+ catalog price/recovery extras).
 *   2. HARD-DELETE every service outside the Phase-0 set. clinic_services.service_id
 *      is nulled (FK SET NULL); concern_services for removed services cascades away.
 *   3. RE-MATCH every clinic_services row against the narrowed catalog so its
 *      service_id / match_status / match_confidence reflect the 15. 'ignored' rows
 *      are left untouched.
 *   4. UPSERT the 10 concerns (+ overview/details editorial from CONCERN_CATALOG).
 *   5. HARD-DELETE every origin='seed' concern outside the Phase-0 set (AI-grown
 *      origin='ai' concerns from the concerns ingest survive re-runs).
 *   6. REBUILD concern_services from the curated CANONICAL_CONCERNS.serviceSlugs map.
 *   7. Recompute hero_rating / hero_review_count for every service.
 *
 * Pass --dry to roll back instead of committing (prints the would-be result).
 */

import pool from "../src/lib/db";
import {
  CANONICAL_SERVICES,
  CANONICAL_CONCERNS,
  PRIORITY_SERVICE_SLUGS,
  matchService,
  bestCatalogMatch,
} from "../src/lib/taxonomy/canonical";
import { TREATMENT_CATALOG } from "../src/lib/treatments/catalog";
import { CONCERN_CATALOG } from "../src/lib/concerns/catalog";

const DRY = process.argv.includes("--dry");

async function counts(client: import("pg").PoolClient) {
  const { rows } = await client.query(`SELECT
    (SELECT count(*) FROM services)         AS services,
    (SELECT count(*) FROM concerns)         AS concerns,
    (SELECT count(*) FROM clinic_services)  AS clinic_services,
    (SELECT count(*) FROM concern_services) AS concern_services`);
  return rows[0];
}

async function reconcile() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("before:", await counts(client));

    const catalogBySlug = new Map(TREATMENT_CATALOG.map((t) => [t.slug, t]));
    const editorialBySlug = new Map(CONCERN_CATALOG.map((c) => [c.slug, c]));

    // ── 1. UPSERT the 15 canonical services ──────────────────────────────────
    for (const svc of CANONICAL_SERVICES) {
      const extra = catalogBySlug.get(svc.slug);
      await client.query(
        `INSERT INTO services
           (name, slug, category, aliases, summary, description,
            treatment_time, results_timeline, results_duration,
            price_from, price_unit, recovery_time,
            is_published, review_status, is_active, origin, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'approved',true,'seed',NOW())
         ON CONFLICT (slug) DO UPDATE SET
           name=EXCLUDED.name, category=EXCLUDED.category, aliases=EXCLUDED.aliases,
           summary=EXCLUDED.summary, description=EXCLUDED.description,
           treatment_time=EXCLUDED.treatment_time, results_timeline=EXCLUDED.results_timeline,
           results_duration=EXCLUDED.results_duration,
           price_from=EXCLUDED.price_from, price_unit=EXCLUDED.price_unit,
           recovery_time=EXCLUDED.recovery_time,
           is_published=EXCLUDED.is_published, review_status='approved',
           is_active=true, origin='seed', updated_at=NOW()`,
        [
          svc.name, svc.slug, svc.category, svc.aliases, svc.summary, svc.description,
          svc.treatment_time, svc.results_timeline, svc.results_duration,
          extra?.price_from ?? null, extra?.price_unit ?? null, extra?.recovery_time ?? null,
          svc.is_published,
        ]
      );
    }
    console.log(`upserted ${CANONICAL_SERVICES.length} canonical services`);

    // ── 2. DELETE seed services outside the Phase-0 set ──────────────────────
    // Only curated ('seed') rows are pruned; AI-grown ('ai') and manual rows
    // survive so the AI-grown catalog persists across reconcile runs.
    const delSvc = await client.query(
      `DELETE FROM services WHERE slug <> ALL($1::text[]) AND origin = 'seed' RETURNING slug`,
      [PRIORITY_SERVICE_SLUGS]
    );
    console.log(`deleted ${delSvc.rowCount} non-priority seed services`);

    // Full surviving catalog: the 15 seed rows + any AI-grown/manual rows.
    const svcRows = await client.query<{ id: string; name: string; slug: string; aliases: string[] | null }>(
      `SELECT id, name, slug, COALESCE(aliases, '{}') AS aliases FROM services`
    );
    const svcIdBySlug = new Map(svcRows.rows.map((r) => [r.slug, r.id]));
    const catalog = svcRows.rows.map((r) => ({ slug: r.slug, name: r.name, aliases: r.aliases ?? [] }));

    // ── 3. RE-MATCH every clinic_services row against the FULL catalog ────────
    // Curated matchService first (the 15 + brand aliases), then the DB catalog
    // (folds AI-grown treatments) so their links aren't nulled out.
    const csRows = await client.query<{ id: string; raw_name: string; match_status: string | null }>(
      `SELECT id, raw_name, match_status FROM clinic_services`
    );
    let matched = 0, auto = 0, unmatched = 0, ignored = 0;
    for (const row of csRows.rows) {
      if (row.match_status === "ignored") { ignored++; continue; }
      let serviceId: string | null = null;
      let confidence = 0;
      const m = matchService(row.raw_name);
      if (m.slug && svcIdBySlug.has(m.slug)) {
        serviceId = svcIdBySlug.get(m.slug)!;
        confidence = m.confidence;
      } else {
        const hit = bestCatalogMatch(row.raw_name, catalog);
        if (hit) {
          serviceId = svcIdBySlug.get(hit.entry.slug) ?? null;
          confidence = hit.confidence;
        }
      }
      const status = serviceId ? (confidence >= 1 ? "matched" : "auto") : "unmatched";
      await client.query(
        `UPDATE clinic_services
           SET service_id=$2, match_status=$3, match_confidence=$4, updated_at=NOW()
         WHERE id=$1`,
        [row.id, serviceId, status, confidence || null]
      );
      if (status === "matched") matched++;
      else if (status === "auto") auto++;
      else unmatched++;
    }
    console.log(`re-matched clinic_services → matched ${matched}, auto ${auto}, unmatched ${unmatched} (ignored kept ${ignored})`);

    // ── 4. UPSERT the 10 concerns (+ editorial) ──────────────────────────────
    for (const def of CANONICAL_CONCERNS) {
      const ed = editorialBySlug.get(def.slug);
      await client.query(
        `INSERT INTO concerns
           (name, slug, overview, details, aliases, data_source, is_published, is_active, origin, updated_at)
         VALUES ($1,$2,$3,$4::jsonb,$5,'curated',true,true,'seed',NOW())
         ON CONFLICT (slug) DO UPDATE SET
           name=EXCLUDED.name,
           overview=COALESCE(EXCLUDED.overview, concerns.overview),
           details=COALESCE(EXCLUDED.details, concerns.details),
           aliases=EXCLUDED.aliases,
           is_published=true, is_active=true, origin='seed', updated_at=NOW()`,
        [
          def.name, def.slug, ed?.overview ?? null,
          ed ? JSON.stringify(ed.details) : null, def.aliases,
        ]
      );
    }
    console.log(`upserted ${CANONICAL_CONCERNS.length} canonical concerns`);

    // ── 5. DELETE concerns outside the Phase-0 set ───────────────────────────
    const concernSlugs = CANONICAL_CONCERNS.map((c) => c.slug);
    const delCon = await client.query(
      `DELETE FROM concerns WHERE slug <> ALL($1::text[]) AND origin = 'seed' RETURNING slug`,
      [concernSlugs]
    );
    console.log(
      `deleted ${delCon.rowCount} non-priority concerns${delCon.rowCount ? `: ${delCon.rows.map((r) => r.slug).join(", ")}` : ""}`
    );

    // ── 6. REBUILD concern_services from the curated map ─────────────────────
    await client.query(`DELETE FROM concern_services`);
    const conRows = await client.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM concerns`
    );
    const conIdBySlug = new Map(conRows.rows.map((r) => [r.slug, r.id]));
    let links = 0;
    for (const def of CANONICAL_CONCERNS) {
      const concernId = conIdBySlug.get(def.slug);
      if (!concernId) continue;
      for (let i = 0; i < def.serviceSlugs.length; i++) {
        const serviceId = svcIdBySlug.get(def.serviceSlugs[i]);
        if (!serviceId) {
          console.warn(`  ⚠ ${def.slug} maps to unknown service slug "${def.serviceSlugs[i]}"`);
          continue;
        }
        const r = await client.query(
          `INSERT INTO concern_services (concern_id, service_id, display_order)
           VALUES ($1,$2,$3) ON CONFLICT (concern_id, service_id) DO NOTHING RETURNING id`,
          [concernId, serviceId, i]
        );
        links += r.rowCount ?? 0;
      }
    }
    console.log(`seeded ${links} concern_services links`);

    // ── 7. Recompute hero stats from offering clinics ────────────────────────
    await client.query(`
      WITH offering AS (
        SELECT DISTINCT s.id AS service_id, c.id AS clinic_id, c.avg_rating, c.review_count
        FROM services s
        JOIN clinic_services cs
          ON cs.service_id = s.id
          OR cs.raw_name ILIKE '%' || s.name || '%'
          OR cs.raw_name ILIKE ANY (SELECT '%' || a || '%' FROM unnest(COALESCE(s.aliases,'{}')) AS a)
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
        FROM offering GROUP BY service_id
      ) AS stats
      WHERE s.id = stats.service_id
    `);

    console.log("after:", await counts(client));

    if (DRY) {
      await client.query("ROLLBACK");
      console.log("🟡 --dry: rolled back, no changes committed");
    } else {
      await client.query("COMMIT");
      console.log("✅ reconcile-taxonomy complete");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ reconcile-taxonomy failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reconcile();
