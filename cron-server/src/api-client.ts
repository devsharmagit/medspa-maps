/**
 * api-client.ts — typed HTTP client for all Next.js internal API calls.
 *
 * The cron server never touches the database directly.
 * Every read and write goes through these methods.
 */

import type { ScrapeResult } from "./types";

const BASE = (process.env.NEXTJS_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.INTERNAL_API_SECRET ?? "";

if (!SECRET) {
  console.error("INTERNAL_API_SECRET is not set — all requests will be rejected");
}

async function internalFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SECRET,
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${options.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }

  return res;
}

// ─── G99 ──────────────────────────────────────────────────────────────────────

export async function getG99Businesses(): Promise<{ id: string; name: string }[]> {
  const res = await internalFetch("/api/internal/g99/businesses");
  const data = await res.json() as { businesses: { id: string; name: string }[] };
  return data.businesses;
}

// ─── G99 Sync ─────────────────────────────────────────────────────────────────

export async function syncBusiness(g99BusinessId: string): Promise<{ ok: boolean; name: string }> {
  const res = await internalFetch("/api/internal/sync/business", {
    method: "POST",
    body: JSON.stringify({ g99BusinessId }),
  });
  return res.json() as Promise<{ ok: boolean; name: string }>;
}

export async function refreshView(): Promise<void> {
  await internalFetch("/api/internal/sync/refresh-view", { method: "POST" });
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

/** Run the scraper on a URL — Next.js does the scraping, returns structured JSON */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const res = await internalFetch("/api/internal/scrape", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  const data = await res.json() as { ok: boolean; result: ScrapeResult };
  return data.result;
}

// ─── Clinics ──────────────────────────────────────────────────────────────────

export interface ClinicForScrape {
  id: string;
  name: string;
  website: string;
  business_id: string;
  business_name: string;
  last_scraped_at: string | null;
}

/** Get non-G99 clinics that need scraping */
export async function getNonG99Clinics(): Promise<ClinicForScrape[]> {
  const res = await internalFetch("/api/internal/clinics/non-g99");
  const data = await res.json() as { clinics: ClinicForScrape[] };
  return data.clinics;
}

/** Save a full scrape result for a clinic */
export async function saveClinicFullScrape(
  clinicId: string,
  result: ScrapeResult & { job_id?: string }
): Promise<{ saved: { services: number; providers: number; images: number } }> {
  const res = await internalFetch(`/api/internal/clinics/${clinicId}/full-scrape`, {
    method: "POST",
    body: JSON.stringify(result),
  });
  return res.json() as Promise<{ saved: { services: number; providers: number; images: number } }>;
}

// ─── Clinic images ────────────────────────────────────────────────────────────

export interface ClinicForImages {
  id: string;
  name: string;
  website: string;
  business_name: string;
}

export async function getClinicsMissingImages(): Promise<ClinicForImages[]> {
  const res = await internalFetch("/api/internal/clinics/missing-images");
  const data = await res.json() as { clinics: ClinicForImages[] };
  return data.clinics;
}

export async function saveClinicImage(
  clinicId: string,
  payload: { source_url: string; scraped_domain: string; alt_text?: string; found: boolean }
): Promise<void> {
  await internalFetch(`/api/internal/clinics/${clinicId}/images`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── Scrape jobs ──────────────────────────────────────────────────────────────

export async function createScrapeJob(payload: {
  clinic_id: string;
  target_url: string;
  job_type: string;
}): Promise<string> {
  const res = await internalFetch("/api/internal/scrape-jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await res.json() as { job_id: string };
  return data.job_id;
}

export async function updateScrapeJob(
  jobId: string,
  payload: {
    status: "done" | "failed";
    error_message?: string;
    services_found?: number;
    providers_found?: number;
    images_found?: number;
  }
): Promise<void> {
  await internalFetch(`/api/internal/scrape-jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
