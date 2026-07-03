/**
 * api.ts — thin HTTP client for the Next.js internal re-scrape endpoints.
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

export interface TreatmentDelta {
  slug: string;
  name: string;
}

export interface RescrapeResult {
  clinicId: string;
  name: string;
  website: string;
  scrapeJobId: string | null;
  added: TreatmentDelta[];
  removed: TreatmentDelta[];
  servicesFound: number;
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

async function call<T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const res = await fetch(`${NEXTJS_URL}${path}`, {
    method,
    headers: {
      "x-internal-secret": SECRET,
      "content-type": "application/json",
    },
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

  listClinics(limit: number, offset: number): Promise<ClinicsPage> {
    return call<ClinicsPage>(
      `/api/internal/rescrape/clinics?limit=${limit}&offset=${offset}`
    );
  },

  rescrapeClinic(id: string): Promise<RescrapeResult> {
    return call<RescrapeResult>(`/api/internal/rescrape/clinic/${id}`, "POST");
  },

  refreshView(): Promise<{ refreshed: boolean }> {
    return call<{ refreshed: boolean }>(`/api/internal/rescrape/refresh-view`, "POST");
  },

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${NEXTJS_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },
};
