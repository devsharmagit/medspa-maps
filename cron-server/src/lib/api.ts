/**
 * api.ts — thin HTTP client for the Next.js internal refresh endpoints.
 *
 * The cron server is a pure orchestrator: it never touches the DB or scrapes
 * directly. It drives everything through /api/internal/rescrape/* which are
 * guarded by the shared X-Internal-Secret header (INTERNAL_API_SECRET).
 */

const NEXTJS_URL = (process.env.NEXTJS_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.INTERNAL_API_SECRET ?? "";

export interface ClinicRef {
  id: string;
  name: string;
  website: string;
  last_scraped_at: string | null;
}

export interface ClinicsPage {
  total: number;
  count: number;
  clinics: ClinicRef[];
}

/**
 * One canonical catalog row (a treatment or a concern) the clinic gained or
 * lost. `slug` is null only for a catalog row that has none.
 */
export interface CatalogDelta {
  slug: string | null;
  name: string;
}

/**
 * MUST stay in sync with `RefreshClinicResult` in
 * web/src/lib/rescrape/refresh-clinic.ts. This is a package boundary, so
 * TypeScript cannot catch drift — a renamed field here just makes the summary
 * print zeros. Change both sides together.
 */
export interface RefreshResult {
  clinicId: string;
  name: string;
  website: string;
  runId: string | null;
  added: CatalogDelta[];
  removed: CatalogDelta[];
  servicesFound: number;
  concernsFound: number;
  pagesVisited: number;
  ok: boolean;
  error: string | null;
  skipped: boolean;
}

/** Canonical { success, data, error } envelope from the Next.js routes. */
interface Envelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

/**
 * Per-request ceiling. A clinic refresh crawls ~130 pages and makes several AI
 * calls, so it is legitimately slow — but without a signal a wedged request
 * pins one of the very few concurrent workers forever. Comfortably above the
 * engine's own REFRESH_BUDGET_MS so its graceful skip wins the race.
 */
const REQUEST_TIMEOUT_MS = Number(process.env.RESCRAPE_REQUEST_TIMEOUT_MS ?? 8 * 60_000);

async function call<T>(
  path: string,
  method: "GET" | "POST" = "GET",
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
  const res = await fetch(`${NEXTJS_URL}${path}`, {
    method,
    headers: {
      "x-internal-secret": SECRET,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  let json: Envelope<T> | null = null;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    // non-JSON body
  }

  if (!res.ok || !json || json.success === false) {
    const msg = json?.error ?? `${method} ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return json.data;
}

export const api = {
  base: NEXTJS_URL,

  listClinics(limit: number, offset: number, staleDays = 0): Promise<ClinicsPage> {
    const stale = staleDays > 0 ? `&staleDays=${staleDays}` : "";
    return call<ClinicsPage>(
      `/api/internal/rescrape/clinics?limit=${limit}&offset=${offset}${stale}`,
      "GET",
      60_000
    );
  },

  refreshClinic(id: string): Promise<RefreshResult> {
    return call<RefreshResult>(`/api/internal/rescrape/clinic/${id}`, "POST");
  },

  refreshView(): Promise<{ refreshed: boolean }> {
    return call<{ refreshed: boolean }>(`/api/internal/rescrape/refresh-view`, "POST");
  },

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${NEXTJS_URL}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
