/**
 * api-client.ts — typed HTTP client for all Next.js internal API calls.
 *
 * The cron server never touches the database directly.
 * Every read and write goes through these methods.
 */

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
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok && res.status !== 200) {
    const text = await res.text().catch(() => "");
    throw new Error(`${options.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }

  return res;
}

// ─── G99 data ─────────────────────────────────────────────────────────────────

export async function getG99Businesses(): Promise<{ id: string; name: string }[]> {
  const res = await internalFetch("/api/internal/g99/businesses");
  const data = await res.json() as { businesses: { id: string; name: string }[] };
  return data.businesses;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

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

// ─── Non-G99 businesses ───────────────────────────────────────────────────────

export async function getNonG99Businesses(): Promise<
  { id: string; name: string; website_url: string }[]
> {
  const res = await internalFetch("/api/internal/businesses/non-g99");
  const data = await res.json() as { businesses: { id: string; name: string; website_url: string }[] };
  return data.businesses;
}

export async function updateBusinessScraped(
  id: string,
  fields: { phone?: string | null; instagram_url?: string | null; facebook_url?: string | null }
): Promise<void> {
  await internalFetch(`/api/internal/businesses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

// ─── Clinic images ────────────────────────────────────────────────────────────

export async function getClinicsMissingImages(): Promise<
  { id: string; name: string; website: string; business_name: string }[]
> {
  const res = await internalFetch("/api/internal/clinics/missing-images");
  const data = await res.json() as {
    clinics: { id: string; name: string; website: string; business_name: string }[];
  };
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
