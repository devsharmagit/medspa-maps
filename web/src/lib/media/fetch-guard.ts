/**
 * media/fetch-guard.ts — SSRF-guarded image fetch used by the capture pipeline.
 *
 * Only used on the CAPTURE side (backfill/cron/admin). The serving endpoint
 * (/api/media) never fetches a URL — it only returns bytes we already stored —
 * so there is no SSRF surface on the read path.
 */

import { lookup } from "node:dns/promises";
import net from "node:net";
import { BROWSER_UA } from "@/lib/scraper/utils";

/** Hard ceiling on the raw download before we even decode (defensive). */
const MAX_RAW_BYTES = 15 * 1024 * 1024; // 15 MB
const FETCH_TIMEOUT_MS = 15_000;

/** True for private / loopback / link-local / cloud-metadata IP ranges. */
function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local + 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("::ffff:")) return isBlockedIp(lower.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // unparseable → block
}

export interface FetchedImage {
  bytes: Buffer;
  contentType: string | null;
}

/**
 * Fetch an image URL with SSRF protection. Returns null on any failure
 * (network, non-2xx, blocked host, oversize) — callers treat null as "miss".
 */
export async function fetchImageGuarded(url: string): Promise<FetchedImage | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  // Resolve host and reject internal targets before connecting.
  try {
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(hostname)) {
      if (isBlockedIp(hostname)) return null;
    } else {
      const results = await lookup(hostname, { all: true });
      if (results.length === 0 || results.some((r) => isBlockedIp(r.address))) return null;
    }
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return null;

    const contentType = res.headers.get("content-type");
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared && declared > MAX_RAW_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_RAW_BYTES) return null;

    return { bytes: buf, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
