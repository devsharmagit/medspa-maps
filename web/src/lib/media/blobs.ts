/**
 * media/blobs.ts — read/write the image blob store (blob_* columns on images and
 * providers). Capture writes only overwrite bytes on a SUCCESSFUL decode; a 404
 * or error never wipes an existing good blob (the core durability guarantee).
 */

import { query, queryOne } from "@/lib/db";
import { captureImage, type ImageRole, type CaptureResult } from "./capture";

const DEFAULT_STALE_DAYS = 30;

export interface StoredBlob {
  bytes: Buffer;
  mime: string;
  etag: string | null;
}

/**
 * Serving lookup: find a stored copy by the URL the page rendered. Matches the
 * images row by source_url OR cdn_url, then falls back to a provider headshot by
 * image_url. Never fetches the URL.
 */
export async function getStoredBlobByUrl(url: string): Promise<StoredBlob | null> {
  const img = await queryOne<{ blob_bytes: Buffer; blob_mime: string | null; blob_etag: string | null }>(
    `SELECT blob_bytes, blob_mime, blob_etag
       FROM images
      WHERE blob_status = 'ok' AND blob_bytes IS NOT NULL
        AND (source_url = $1 OR cdn_url = $1)
      LIMIT 1`,
    [url]
  );
  if (img?.blob_bytes) {
    return { bytes: img.blob_bytes, mime: img.blob_mime ?? "image/webp", etag: img.blob_etag };
  }

  const prov = await queryOne<{ blob_bytes: Buffer; blob_mime: string | null; blob_etag: string | null }>(
    `SELECT blob_bytes, blob_mime, blob_etag
       FROM providers
      WHERE blob_status = 'ok' AND blob_bytes IS NOT NULL AND image_url = $1
      LIMIT 1`,
    [url]
  );
  if (prov?.blob_bytes) {
    return { bytes: prov.blob_bytes, mime: prov.blob_mime ?? "image/webp", etag: prov.blob_etag };
  }

  return null;
}

async function persistCapture(
  table: "images" | "providers",
  id: string,
  result: CaptureResult
): Promise<CaptureResult["status"]> {
  if (result.status === "ok") {
    await query(
      `UPDATE ${table} SET
         blob_bytes = $2, blob_mime = $3, blob_size = $4, blob_width = $5,
         blob_height = $6, blob_etag = $7, blob_status = 'ok',
         blob_captured_at = NOW(), blob_checked_at = NOW()
       WHERE id = $1`,
      [id, result.bytes, result.mime, result.size, result.width, result.height, result.etag]
    );
    return "ok";
  }
  // Failure — record the attempt but NEVER wipe an existing good blob.
  await query(
    `UPDATE ${table} SET blob_status = $2, blob_checked_at = NOW()
      WHERE id = $1 AND blob_status <> 'ok'`,
    [id, result.status]
  );
  return result.status;
}

/** Capture + store the blob for one images row. */
export async function captureImageRow(imageId: string): Promise<CaptureResult["status"]> {
  const row = await queryOne<{ source_url: string | null; cdn_url: string | null; role: string }>(
    `SELECT source_url, cdn_url, role FROM images WHERE id = $1`,
    [imageId]
  );
  if (!row) return "error";
  const url = row.source_url || row.cdn_url;
  if (!url) return "error";
  const result = await captureImage(url, (row.role as ImageRole) || "gallery");
  return persistCapture("images", imageId, result);
}

/** Capture + store the blob for one provider headshot. */
export async function captureProviderRow(providerId: string): Promise<CaptureResult["status"]> {
  const row = await queryOne<{ image_url: string | null }>(
    `SELECT image_url FROM providers WHERE id = $1`,
    [providerId]
  );
  if (!row?.image_url) return "error";
  const result = await captureImage(row.image_url, "provider");
  return persistCapture("providers", providerId, result);
}

export interface CaptureClinicResult {
  ok: number;
  too_big: number;
  error: number;
  skipped: number;
}

interface CaptureClinicOpts {
  force?: boolean;
  staleDays?: number;
  concurrency?: number;
}

function isFresh(status: string | null, checkedAt: string | null, staleDays: number): boolean {
  if (status !== "ok" || !checkedAt) return false;
  const ageMs = Date.now() - new Date(checkedAt).getTime();
  return ageMs < staleDays * 24 * 60 * 60 * 1000;
}

/** Run tasks with bounded concurrency. */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

/**
 * Capture every image (logo/cover/gallery/before_after) and provider headshot for
 * a clinic. Skips rows already captured recently unless `force`.
 */
export async function captureClinic(
  clinicId: string,
  opts: CaptureClinicOpts = {}
): Promise<CaptureClinicResult> {
  const { force = false, staleDays = DEFAULT_STALE_DAYS, concurrency = 4 } = opts;
  const res: CaptureClinicResult = { ok: 0, too_big: 0, error: 0, skipped: 0 };

  const images = await query<{ id: string; blob_status: string | null; blob_checked_at: string | null }>(
    `SELECT id, blob_status, blob_checked_at
       FROM images
      WHERE entity_type = 'clinic' AND entity_id = $1
        AND source_url IS NOT NULL AND source_url <> ''`,
    [clinicId]
  );
  const providers = await query<{ id: string; blob_status: string | null; blob_checked_at: string | null }>(
    `SELECT id, blob_status, blob_checked_at
       FROM providers
      WHERE clinic_id = $1 AND image_url IS NOT NULL AND image_url <> ''`,
    [clinicId]
  );

  const tally = (status: CaptureResult["status"]) => {
    if (status === "ok") res.ok++;
    else if (status === "too_big") res.too_big++;
    else res.error++;
  };

  await mapLimit(images, concurrency, async (row) => {
    if (!force && isFresh(row.blob_status, row.blob_checked_at, staleDays)) {
      res.skipped++;
      return;
    }
    tally(await captureImageRow(row.id));
  });

  await mapLimit(providers, concurrency, async (row) => {
    if (!force && isFresh(row.blob_status, row.blob_checked_at, staleDays)) {
      res.skipped++;
      return;
    }
    tally(await captureProviderRow(row.id));
  });

  return res;
}
