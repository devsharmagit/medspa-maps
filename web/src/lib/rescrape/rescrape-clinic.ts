/**
 * rescrape/rescrape-clinic.ts — re-scrape ONE clinic and reconcile its treatments.
 *
 * Flow (per clinic):
 *   1. detectClinicServices() — live scrape, OUTSIDE any DB transaction
 *   2. SAFETY: if the site was unreachable (0 pages) or nothing parsed, abort
 *      WITHOUT touching treatments — a transient outage or parse hiccup must
 *      never look like "removed everything"
 *   3. in ONE transaction:
 *        - snapshot the clinic's current canonical set (oldEffective)
 *        - upsert freshly-scraped raw services (reactivating reappearing ones)
 *        - soft-deactivate active rows that vanished from the site
 *        - re-read the canonical set (newEffective) → diff added / removed
 *        - refresh scraped cover/gallery images; bump clinics.last_scraped_at
 *
 * The added/removed deltas are returned in the result. (The scrape_jobs and
 * clinic_service_changes audit tables were removed in the 2026-07-18 simplification.)
 */

import pool, { withTransaction } from "@/lib/db";
import { detectClinicServices } from "@/lib/rescrape/detect";

export interface TreatmentDelta {
  slug: string;
  name: string;
}

export interface RescrapeClinicResult {
  clinicId: string;
  name: string;
  website: string;
  scrapeJobId: string | null;
  added: TreatmentDelta[];
  removed: TreatmentDelta[];
  servicesFound: number;
  imagesFound: number;
  pagesVisited: number;
  /** true when the run completed (scrape reached the site and diff applied) */
  ok: boolean;
  /** set when the clinic was skipped or the scrape failed */
  error: string | null;
  skipped: boolean;
}

interface ClinicRow {
  id: string;
  name: string;
  website: string | null;
}

/** matched | auto | unmatched — mirrors saveClinicBundle's classification. */
function classify(serviceId: string | null, confidence: number): "matched" | "auto" | "unmatched" {
  if (!serviceId) return "unmatched";
  return confidence >= 1 ? "matched" : "auto";
}

export async function rescrapeClinic(clinicId: string): Promise<RescrapeClinicResult> {
  const base: Omit<RescrapeClinicResult, "ok" | "error" | "skipped"> = {
    clinicId,
    name: "",
    website: "",
    scrapeJobId: null,
    added: [],
    removed: [],
    servicesFound: 0,
    imagesFound: 0,
    pagesVisited: 0,
  };

  // ── load clinic ────────────────────────────────────────────────────────────
  const clinic = (
    await pool.query<ClinicRow>(
      `SELECT id, name, website FROM clinics WHERE id = $1 AND is_active = true`,
      [clinicId]
    )
  ).rows[0];

  if (!clinic) {
    return { ...base, ok: false, skipped: true, error: "clinic not found or inactive" };
  }
  base.name = clinic.name;
  base.website = clinic.website ?? "";

  if (!clinic.website || !clinic.website.trim()) {
    return { ...base, ok: false, skipped: true, error: "clinic has no website" };
  }

  // scrape_jobs tracking removed with the table; the run result is returned directly.
  try {
    // ── live scrape (no DB txn held during network I/O) ───────────────────────
    const detection = await detectClinicServices(clinic.website);
    base.servicesFound = detection.services.length;
    base.imagesFound = detection.images.length;
    base.pagesVisited = detection.pagesVisited;

    // SAFETY: site unreachable → do NOT reconcile (would wipe all treatments).
    if (detection.pagesVisited === 0) {
      return {
        ...base,
        ok: false,
        skipped: true,
        error: "site unreachable — treatments left unchanged",
      };
    }

    // Non-noise detected services become clinic_services rows (matched + real
    // unmatched). raw_name is the natural key against clinic_services.
    const freshServices = detection.services.filter((s) => !s.is_noise);
    const freshRawNames = freshServices.map((s) => s.raw_name);

    // SAFETY: reachable site but ZERO services parsed is almost always a layout/
    // parse change, not a clinic that dropped every treatment. Reconciling here
    // would soft-delete the clinic's entire menu on one bad parse, so we skip.
    if (freshServices.length === 0) {
      return {
        ...base,
        ok: false,
        skipped: true,
        error: "no services parsed — treatments left unchanged",
      };
    }

    const { added, removed } = await withTransaction(async (client) => {
      // canonical slug → { id, name } for every active service (for logging + fk)
      const svcRows = (
        await client.query<{ id: string; name: string; slug: string }>(
          `SELECT id, name, slug FROM services WHERE is_active = true`
        )
      ).rows;
      const svcBySlug = new Map(svcRows.map((r) => [r.slug, r]));

      // effective canonical set BEFORE (any active row, scraped or manual)
      const oldSet = new Set(
        (
          await client.query<{ slug: string }>(
            `SELECT DISTINCT s.slug
               FROM clinic_services cs
               JOIN services s ON s.id = cs.service_id
              WHERE cs.clinic_id = $1 AND cs.is_active = true`,
            [clinicId]
          )
        ).rows.map((r) => r.slug)
      );

      // upsert fresh scraped rows (reactivate reappearing scraped treatments)
      for (const s of freshServices) {
        const svc = s.slug ? svcBySlug.get(s.slug) : undefined;
        const serviceId = svc?.id ?? null;
        const matchStatus = classify(serviceId, s.confidence);
        await client.query(
          `INSERT INTO clinic_services
             (clinic_id, service_id, raw_name, description, match_status, is_active)
           VALUES ($1,$2,$3,$4,$5,true)
           ON CONFLICT (clinic_id, raw_name) DO UPDATE SET
             service_id = EXCLUDED.service_id,
             description = COALESCE(EXCLUDED.description, clinic_services.description),
             match_status = EXCLUDED.match_status,
             is_active = true,
             updated_at = NOW()`,
          [clinicId, serviceId, s.raw_name, s.description, matchStatus]
        );
      }

      // soft-deactivate rows that vanished from the site this run.
      // (The scraped/manual distinction was removed with clinic_services.data_source.)
      await client.query(
        `UPDATE clinic_services
            SET is_active = false, updated_at = NOW()
          WHERE clinic_id = $1
            AND is_active = true
            AND raw_name <> ALL($2::text[])`,
        [clinicId, freshRawNames]
      );

      // effective canonical set AFTER
      const newSet = new Set(
        (
          await client.query<{ slug: string }>(
            `SELECT DISTINCT s.slug
               FROM clinic_services cs
               JOIN services s ON s.id = cs.service_id
              WHERE cs.clinic_id = $1 AND cs.is_active = true`,
            [clinicId]
          )
        ).rows.map((r) => r.slug)
      );

      const addedSlugs = [...newSet].filter((s) => !oldSet.has(s));
      const removedSlugs = [...oldSet].filter((s) => !newSet.has(s));

      const addedOut: TreatmentDelta[] = [];
      const removedOut: TreatmentDelta[] = [];

      // clinic_service_changes audit log removed with the table; deltas are still
      // computed and returned in the result.
      for (const slug of addedSlugs) {
        const svc = svcBySlug.get(slug);
        if (!svc) continue;
        addedOut.push({ slug: svc.slug, name: svc.name });
      }

      for (const slug of removedSlugs) {
        const svc = svcBySlug.get(slug);
        if (!svc) continue;
        removedOut.push({ slug: svc.slug, name: svc.name });
      }

      // ── image refresh ─────────────────────────────────────────────────────
      // Replace SCRAPED cover/gallery rows with this run's set so cover/junk
      // fixes propagate on rescrape. before_after is INTENTIONALLY excluded:
      // this rescrape path's detector never produces before/after images, so
      // deleting them here would wipe them every night — they're refreshed only
      // by the AI ingest (ingestClinicByDomain). Two protections:
      //   * skip entirely when the scrape found no images (parse hiccup must
      //     never wipe a clinic's gallery — mirrors the zero-services safety)
      //   * curated rows (cdn_url or storage_key set → uploaded/processed by
      //     an admin) are never deleted; if a curated cover exists, the fresh
      //     scraped cover is demoted to gallery instead of competing with it.
      if (detection.images.length > 0) {
        const domain = (() => {
          try { return new URL(clinic.website!).hostname; } catch { return null; }
        })();

        const curated = await client.query<{ role: string }>(
          `SELECT role FROM images
            WHERE entity_type = 'clinic' AND entity_id = $1
              AND (cdn_url IS NOT NULL OR storage_key IS NOT NULL)`,
          [clinicId]
        );
        const hasCuratedCover = curated.rows.some((r) => r.role === "cover");

        await client.query(
          `DELETE FROM images
            WHERE entity_type = 'clinic' AND entity_id = $1
              AND role IN ('cover', 'gallery')
              AND cdn_url IS NULL AND storage_key IS NULL`,
          [clinicId]
        );

        let sort = 0;
        const seen = new Set<string>();
        for (const img of detection.images) {
          if (seen.has(img.source_url)) continue;
          seen.add(img.source_url);
          const role =
            img.role === "cover" && hasCuratedCover ? "gallery" : img.role;
          // (entity_type, entity_id, source_url) is UNIQUE — a scraped URL can
          // collide with a surviving curated row; keep the curated row's cdn
          // fields and just refresh metadata.
          await client.query(
            `INSERT INTO images
               (entity_type, entity_id, source_url, role, sort_order, alt_text,
                scraped_domain, scrape_status, last_checked_at)
             VALUES ('clinic', $1, $2, $3, $4, $5, $6, 'ok', NOW())
             ON CONFLICT (entity_type, entity_id, source_url) DO UPDATE SET
               role = EXCLUDED.role,
               sort_order = EXCLUDED.sort_order,
               alt_text = COALESCE(EXCLUDED.alt_text, images.alt_text),
               scrape_status = 'ok',
               last_checked_at = NOW(),
               updated_at = NOW()`,
            [clinicId, img.source_url, role, img.sort_order ?? sort, img.alt_text ?? null, domain]
          );
          sort++;
        }
      }

      await client.query(
        `UPDATE clinics SET last_scraped_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [clinicId]
      );

      return { added: addedOut, removed: removedOut };
    });

    return { ...base, added, removed, ok: true, skipped: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return { ...base, ok: false, skipped: false, error: message };
  }
}
