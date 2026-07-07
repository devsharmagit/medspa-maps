/**
 * rescrape/rescrape-clinic.ts — re-scrape ONE clinic and reconcile its
 * treatments, recording every canonical add/remove into clinic_service_changes.
 *
 * Flow (per clinic):
 *   1. open a scrape_jobs row (status 'running')
 *   2. detectClinicServices() — live scrape, OUTSIDE any DB transaction
 *   3. SAFETY: if the site was unreachable (0 pages), abort WITHOUT touching
 *      treatments — a transient outage must never look like "removed everything"
 *   4. in ONE transaction:
 *        - snapshot the clinic's current canonical set (oldEffective)
 *        - upsert freshly-scraped raw services (reactivating reappearing ones)
 *        - soft-deactivate scraped rows that vanished from the site
 *        - re-read the canonical set (newEffective)
 *        - diff → added / removed, insert one change row each
 *        - bump clinics.last_scraped_at
 *   5. close the scrape_jobs row (completed / failed)
 *
 * The diff is computed on the EFFECTIVE canonical set (any active clinic_services
 * row, scraped OR manual), but only 'scraped' rows are mutated — so admin-forced
 * treatments are never removed by the cron and never spuriously logged.
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

  // ── open a scrape job ───────────────────────────────────────────────────────
  const jobId = (
    await pool.query<{ id: string }>(
      `INSERT INTO scrape_jobs (clinic_id, target_url, job_type, status, started_at)
       VALUES ($1, $2, 'rescrape', 'running', NOW()) RETURNING id`,
      [clinicId, clinic.website]
    )
  ).rows[0].id;
  base.scrapeJobId = jobId;

  try {
    // ── live scrape (no DB txn held during network I/O) ───────────────────────
    const detection = await detectClinicServices(clinic.website);
    base.servicesFound = detection.services.length;
    base.imagesFound = detection.images.length;
    base.pagesVisited = detection.pagesVisited;

    // SAFETY: site unreachable → do NOT reconcile (would wipe all treatments).
    if (detection.pagesVisited === 0) {
      await pool.query(
        `UPDATE scrape_jobs
            SET status = 'failed', finished_at = NOW(),
                error_message = 'site unreachable (0 pages fetched)',
                services_found = 0
          WHERE id = $1`,
        [jobId]
      );
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
      await pool.query(
        `UPDATE scrape_jobs
            SET status = 'completed', finished_at = NOW(), services_found = 0,
                error_message = 'no services parsed — treatments left unchanged'
          WHERE id = $1`,
        [jobId]
      );
      return {
        ...base,
        ok: false,
        skipped: true,
        error: "no services parsed — treatments left unchanged",
      };
    }

    // best (highest-confidence) raw hit per canonical slug — for the change log.
    const bestBySlug = new Map<string, { raw_name: string; confidence: number }>();
    for (const s of freshServices) {
      if (!s.slug) continue;
      const cur = bestBySlug.get(s.slug);
      if (!cur || s.confidence > cur.confidence) {
        bestBySlug.set(s.slug, { raw_name: s.raw_name, confidence: s.confidence });
      }
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
             (clinic_id, service_id, raw_name, description, match_status, match_confidence,
              data_source, scraped_from_url, last_scraped_at, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,'scraped',$7,NOW(),true)
           ON CONFLICT (clinic_id, raw_name) DO UPDATE SET
             service_id = EXCLUDED.service_id,
             description = COALESCE(EXCLUDED.description, clinic_services.description),
             match_status = EXCLUDED.match_status,
             match_confidence = EXCLUDED.match_confidence,
             scraped_from_url = COALESCE(EXCLUDED.scraped_from_url, clinic_services.scraped_from_url),
             last_scraped_at = NOW(),
             is_active = true,
             updated_at = NOW()`,
          [
            clinicId,
            serviceId,
            s.raw_name,
            s.description,
            matchStatus,
            s.confidence || null,
            s.scraped_from_url,
          ]
        );
      }

      // soft-deactivate SCRAPED rows that vanished from the site this run.
      // Manual rows (data_source='manual') are never touched by the cron.
      await client.query(
        `UPDATE clinic_services
            SET is_active = false, updated_at = NOW()
          WHERE clinic_id = $1
            AND data_source = 'scraped'
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

      for (const slug of addedSlugs) {
        const svc = svcBySlug.get(slug);
        if (!svc) continue;
        const best = bestBySlug.get(slug);
        await client.query(
          `INSERT INTO clinic_service_changes
             (clinic_id, service_id, service_slug, service_name, change_type,
              raw_name, match_confidence, scrape_job_id)
           VALUES ($1,$2,$3,$4,'added',$5,$6,$7)`,
          [clinicId, svc.id, svc.slug, svc.name, best?.raw_name ?? null, best?.confidence ?? null, jobId]
        );
        addedOut.push({ slug: svc.slug, name: svc.name });
      }

      for (const slug of removedSlugs) {
        const svc = svcBySlug.get(slug);
        if (!svc) continue;
        await client.query(
          `INSERT INTO clinic_service_changes
             (clinic_id, service_id, service_slug, service_name, change_type,
              raw_name, match_confidence, scrape_job_id)
           VALUES ($1,$2,$3,$4,'removed',NULL,NULL,$5)`,
          [clinicId, svc.id, svc.slug, svc.name, jobId]
        );
        removedOut.push({ slug: svc.slug, name: svc.name });
      }

      // ── image refresh ─────────────────────────────────────────────────────
      // Replace SCRAPED image rows (cover/gallery/before_after) with this run's
      // set so cover/junk fixes propagate on rescrape. Two protections:
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
              AND role IN ('cover', 'gallery', 'before_after')
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

    await pool.query(
      `UPDATE scrape_jobs
          SET status = 'completed', finished_at = NOW(), services_found = $2,
              images_found = $3, error_message = NULL
        WHERE id = $1`,
      [jobId, base.servicesFound, base.imagesFound]
    );

    return { ...base, added, removed, ok: true, skipped: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    await pool
      .query(
        `UPDATE scrape_jobs
            SET status = 'failed', finished_at = NOW(), error_message = $2
          WHERE id = $1`,
        [jobId, message.slice(0, 500)]
      )
      .catch(() => {});
    return { ...base, ok: false, skipped: false, error: message };
  }
}
