/**
 * Typed HTTP client for all internal Next.js API calls.
 * Every request carries X-Internal-Secret for authentication.
 */

const BASE = (process.env.NEXTJS_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.INTERNAL_API_SECRET ?? "";
const TIMEOUT_MS = 30_000;

function headers(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET ?? "";
  return {
    "Content-Type": "application/json",
    "x-internal-secret": secret,
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: headers(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  const body = await res.json();
  return body.data as T;
}

async function post<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  const body = await res.json();
  return body.data as T;
}

// ── Typed callers ─────────────────────────────────────────────────────────────

import type {
  G99Business,
  UpsertBusinessResponse,
  UpsertClinicResponse,
  ManualClinic,
  G99Clinic,
  ScrapeApiResponse,
} from "../types";

export const api = {
  /** Fetch all G99 businesses with their clinics */
  getG99Businesses(): Promise<G99Business[]> {
    return get<G99Business[]>("/api/internal/g99/businesses");
  },

  /** Upsert a G99 business (creates or updates) — returns our internal UUID */
  upsertBusiness(g99Business: G99Business): Promise<UpsertBusinessResponse> {
    return post<UpsertBusinessResponse>("/api/internal/sync/upsert-business", {
      g99Business,
    });
  },

  /** Upsert a G99 clinic under an existing business — returns our internal UUID */
  upsertClinic(
    ourBusinessId: string,
    g99Clinic: G99Clinic
  ): Promise<UpsertClinicResponse> {
    console.log(g99Clinic.clinic_name, g99Clinic.clinic_website)
    return post<UpsertClinicResponse>("/api/internal/sync/upsert-clinic", {
      ourBusinessId,
      g99Clinic,
    });
  },

  /** Store scrape results (services + images) for a clinic */
  storeScrape(payload: {
    clinicId: string;
    businessId: string;
    scrapeResult: ScrapeApiResponse;
  }): Promise<{ services_saved: number; images_saved: number }> {
    return post("/api/internal/sync/store-scrape", payload);
  },

  /** Deactivate G99 records that no longer appear in G99 */
  deactivateStale(
    seenClinicIds: number[],
    seenBusinessIds: number[]
  ): Promise<{ clinics_deactivated: number; businesses_deactivated: number }> {
    return post("/api/internal/sync/deactivate-stale", {
      seenClinicIds,
      seenBusinessIds,
    });
  },

  /** Get all active manual-entry clinics that have a scrapable website */
  getManualClinics(): Promise<ManualClinic[]> {
    return get<ManualClinic[]>("/api/internal/sync/manual-clinics");
  },

  /** Refresh the clinic_search_view materialized view */
  refreshView(): Promise<void> {
    return post("/api/internal/sync/refresh-view", {});
  },
};
