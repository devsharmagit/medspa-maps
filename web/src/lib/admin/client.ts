/**
 * admin/client.ts — browser-side fetch helpers for the admin UI.
 *
 * Every helper targets the `/api/admin/*` endpoints, sends the next-auth
 * session cookie (credentials: "include"), and unwraps the canonical
 * { success, data, error } envelope produced by src/lib/api-response.ts.
 * On a non-2xx response or `success: false`, it throws an Error carrying
 * the server-provided message.
 */

import type { ApiResponse } from "@/lib/api-response";

const BASE = "/api/admin";

function buildPath(path: string): string {
  if (path.startsWith("http")) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean.startsWith("/api/") ? clean : `${BASE}${clean}`;
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(buildPath(path), {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    // No / invalid JSON body.
  }

  if (!res.ok || !payload || payload.success === false) {
    const message =
      (payload && payload.success === false && payload.error) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  return payload.data;
}

export function adminGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export function adminPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function adminPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function adminDelete<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("DELETE", path, body);
}
