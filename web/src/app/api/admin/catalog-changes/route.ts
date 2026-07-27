/**
 * GET /api/admin/catalog-changes — treatments/concerns refresh history.
 *
 * Three views, because the natural shape is clinic → runs → changes and the
 * middle level grows without bound (every clinic gains a run per cron cycle).
 * Loading all three levels at once would mean re-fetching the whole history to
 * open one clinic, so runs are fetched per clinic on demand:
 *
 *   (default)        one summary row per clinic that has ever been refreshed
 *   ?clinicId=<id>   that clinic's runs, each with its change rows nested
 *   ?view=pending    active clinics with a website that have NEVER been refreshed
 *
 * Runs are returned with changes nested rather than as a flat change feed: a
 * `skipped` run has no change rows but is the most actionable thing here, and an
 * add+remove pair inside one run is usually the catalog re-bucketing a row rather
 * than two real changes — only side by side does that read correctly.
 */

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export interface CatalogChangeRow {
  entity_type: "service" | "concern";
  change_type: "added" | "removed";
  name: string;
  slug: string | null;
}

/** One clinic in the top-level list. */
export interface ClinicHistorySummary {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  website: string | null;
  last_run_at: string;
  last_status: string;
  last_trigger: string;
  run_count: number;
  skipped_count: number;
  added_total: number;
  removed_total: number;
  services_now: number | null;
  concerns_now: number | null;
}

/** A clinic that the refresh has never touched. */
export interface PendingClinic {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  website: string | null;
  last_scraped_at: string | null;
}

export interface RefreshRunRow {
  id: string;
  trigger: string;
  status: string;
  crawl_health: number | null;
  pages_fetched: number | null;
  pages_requested: number | null;
  services_before: number | null;
  services_after: number | null;
  concerns_before: number | null;
  concerns_after: number | null;
  note: string | null;
  started_at: string;
  finished_at: string | null;
  changes: CatalogChangeRow[];
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const sp = req.nextUrl.searchParams;
    const clinicId = sp.get("clinicId");
    const view = sp.get("view");

    // ── Level 2+3: one clinic's runs, with their changes nested ──────────────
    if (clinicId) {
      const runs = await query<RefreshRunRow>(
        `SELECT r.id, r.trigger, r.status, r.crawl_health,
                r.pages_fetched, r.pages_requested,
                r.services_before, r.services_after,
                r.concerns_before, r.concerns_after,
                r.note, r.started_at, r.finished_at,
                COALESCE(
                  (SELECT json_agg(json_build_object(
                            'entity_type', c.entity_type,
                            'change_type', c.change_type,
                            'name', c.name,
                            'slug', c.slug)
                          ORDER BY c.entity_type, c.change_type, c.name)
                     FROM clinic_catalog_changes c WHERE c.run_id = r.id),
                  '[]'::json
                ) AS changes
           FROM clinic_refresh_runs r
          WHERE r.clinic_id = $1
          ORDER BY r.started_at DESC
          LIMIT 100`,
        [clinicId]
      );
      return successResponse(runs);
    }

    // ── Clinics the refresh has never reached ────────────────────────────────
    if (view === "pending") {
      const pending = await query<PendingClinic>(
        `SELECT c.id AS clinic_id, c.name AS clinic_name, c.slug AS clinic_slug,
                c.website, c.last_scraped_at
           FROM clinics c
          WHERE c.is_active
            AND c.website IS NOT NULL AND btrim(c.website) <> ''
            AND NOT EXISTS (SELECT 1 FROM clinic_refresh_runs r WHERE r.clinic_id = c.id)
          ORDER BY c.last_scraped_at ASC NULLS FIRST, c.name
          LIMIT 500`
      );
      return successResponse(pending);
    }

    // ── Level 1: one row per clinic that has been refreshed ──────────────────
    // DISTINCT ON gives the newest run per clinic for last_status/last_trigger;
    // the aggregate join supplies the totals across all of its runs.
    const clinics = await query<ClinicHistorySummary>(
      `WITH per_clinic AS (
         SELECT r.clinic_id,
                count(*)::int AS run_count,
                count(*) FILTER (WHERE r.status = 'skipped')::int AS skipped_count,
                max(r.started_at) AS last_run_at,
                COALESCE(sum((SELECT count(*) FROM clinic_catalog_changes c
                               WHERE c.run_id = r.id AND c.change_type = 'added')), 0)::int AS added_total,
                COALESCE(sum((SELECT count(*) FROM clinic_catalog_changes c
                               WHERE c.run_id = r.id AND c.change_type = 'removed')), 0)::int AS removed_total
           FROM clinic_refresh_runs r
          GROUP BY r.clinic_id
       ),
       latest AS (
         SELECT DISTINCT ON (r.clinic_id)
                r.clinic_id, r.status AS last_status, r.trigger AS last_trigger,
                r.services_after AS services_now, r.concerns_after AS concerns_now
           FROM clinic_refresh_runs r
          ORDER BY r.clinic_id, r.started_at DESC
       )
       SELECT cl.id AS clinic_id, cl.name AS clinic_name, cl.slug AS clinic_slug,
              cl.website,
              p.last_run_at, p.run_count, p.skipped_count,
              p.added_total, p.removed_total,
              l.last_status, l.last_trigger, l.services_now, l.concerns_now
         FROM per_clinic p
         JOIN latest l ON l.clinic_id = p.clinic_id
         JOIN clinics cl ON cl.id = p.clinic_id
        ORDER BY p.last_run_at DESC`
    );
    return successResponse(clinics);
  } catch (err) {
    return handleApiError(err);
  }
}
