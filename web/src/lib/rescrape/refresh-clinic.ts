/**
 * rescrape/refresh-clinic.ts — refresh ONE existing clinic's treatments and
 * concerns on behalf of the scheduled job.
 *
 * This is deliberately thin. It used to be a ~280-line parallel implementation
 * (`rescrape-clinic.ts` + `detect.ts`) built on the legacy heuristic scraper: no
 * AI, services only, concerns never touched. That meant a clinic's menu could
 * disagree with itself depending on whether the admin import or the nightly job
 * ran last. Now the schedule calls the SAME engine the two admin buttons call,
 * so all three agree by construction — including the safety guards, the atomic
 * save, and the `clinic_refresh_runs` / `clinic_catalog_changes` history.
 *
 * Scope is treatments + concerns only. Clinic details, images, providers and
 * before/after are refreshed by the admin import path, not on a schedule.
 */

import { query, queryOne } from "@/lib/db";
import {
  ingestTreatmentsAndConcernsForClinic,
  type TreatmentsConcernsResult,
} from "@/lib/ingest/ingest-treatments-concerns";

/**
 * Wall-clock budget for one clinic. Beyond this the engine treats the run as a
 * degraded crawl and skips the save rather than persisting a half-crawled site.
 *
 * Must stay under **300s**, and not for a soft reason: Node's undici sets a
 * 300s `headersTimeout`, and a route's response headers are not sent until it
 * returns. A refresh that runs longer than that fails on the cron client with an
 * opaque "The operation timed out" no matter what `AbortSignal` we configure — so
 * the budget has to expire first, turning that into a recorded `skipped` run with
 * a real reason. 240s leaves ~60s of headroom, since the deadline is only checked
 * between crawl waves and AI waves and so can overshoot slightly.
 */
const REFRESH_BUDGET_MS = 240_000;

/**
 * The cron-server reads these field names across a package boundary, so
 * TypeScript cannot catch drift here — changing them silently makes the job log
 * zeros. Keep the shape stable, or change `cron-server/src/lib/api.ts` in the
 * same commit.
 */
export interface RefreshDelta {
  slug: string | null;
  name: string;
}

export interface RefreshClinicResult {
  clinicId: string;
  name: string;
  website: string;
  runId: string | null;
  added: RefreshDelta[];
  removed: RefreshDelta[];
  servicesFound: number;
  concernsFound: number;
  pagesVisited: number;
  /** true when the run reached the site and the save was applied */
  ok: boolean;
  /** set when the clinic was skipped or the refresh failed */
  error: string | null;
  skipped: boolean;
}

/**
 * Advance the scheduler's cursor. `last_scraped_at` is bumped on every ATTEMPT,
 * not only on success — the list query orders by it, so a clinic that fails
 * every time would otherwise sit permanently at the head of the queue and
 * starve the clinics that actually need refreshing. It also makes a long run
 * restart-safe together with the `staleDays` filter.
 */
async function markAttempted(clinicId: string): Promise<void> {
  await query(`UPDATE clinics SET last_scraped_at = NOW() WHERE id = $1`, [clinicId]);
}

export async function refreshClinicById(clinicId: string): Promise<RefreshClinicResult> {
  const clinic = await queryOne<{ id: string; name: string; website: string | null }>(
    `SELECT id, name, website FROM clinics WHERE id = $1 AND is_active = true`,
    [clinicId]
  );

  const base: Omit<RefreshClinicResult, "ok" | "error" | "skipped"> = {
    clinicId,
    name: clinic?.name ?? "",
    website: clinic?.website ?? "",
    runId: null,
    added: [],
    removed: [],
    servicesFound: 0,
    concernsFound: 0,
    pagesVisited: 0,
  };

  if (!clinic) {
    return { ...base, ok: false, skipped: true, error: "clinic not found or inactive" };
  }
  if (!clinic.website?.trim()) {
    return { ...base, ok: false, skipped: true, error: "clinic has no website" };
  }

  let result: TreatmentsConcernsResult;
  try {
    result = await ingestTreatmentsAndConcernsForClinic(clinicId, {
      trigger: "cron_refresh",
      deadlineMs: REFRESH_BUDGET_MS,
    });
  } catch (err) {
    await markAttempted(clinicId);
    return {
      ...base,
      ok: false,
      skipped: false,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
  await markAttempted(clinicId);

  const toDelta = (c: { name: string; slug: string | null }): RefreshDelta => ({
    slug: c.slug,
    name: c.name,
  });

  return {
    ...base,
    runId: result.runId ?? null,
    added: result.added.map(toDelta),
    removed: result.removed.map(toDelta),
    servicesFound: result.treatmentsFound,
    concernsFound: result.concernsSaved,
    pagesVisited: result.pagesFetched,
    ok: result.status === "saved",
    skipped: result.status === "skipped",
    error: result.status === "saved" ? null : result.note ?? result.status,
  };
}
