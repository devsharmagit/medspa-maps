/**
 * media/capture.ts — fetch an image and re-encode it to a compact WebP copy for
 * the Postgres blob store. Never stores garbage: an undecodable/oversize input
 * yields null or a `too_big` marker.
 */

import { createHash } from "node:crypto";
import sharp from "sharp";
import { fetchImageGuarded } from "./fetch-guard";

export type ImageRole = "logo" | "cover" | "gallery" | "before_after" | "provider";

interface RoleConfig {
  maxDim: number;
  capBytes: number;
}

const ROLE_CONFIG: Record<ImageRole, RoleConfig> = {
  logo: { maxDim: 512, capBytes: 120 * 1024 },
  cover: { maxDim: 1600, capBytes: 400 * 1024 },
  gallery: { maxDim: 1600, capBytes: 400 * 1024 },
  before_after: { maxDim: 1600, capBytes: 400 * 1024 },
  provider: { maxDim: 512, capBytes: 150 * 1024 },
};

export interface CapturedBlob {
  status: "ok";
  bytes: Buffer;
  mime: "image/webp";
  width: number | null;
  height: number | null;
  size: number;
  etag: string;
}

export interface CaptureFailure {
  status: "too_big" | "error";
}

export type CaptureResult = CapturedBlob | CaptureFailure;

const QUALITY_STEPS = [80, 70, 60, 50, 40];

/**
 * Fetch `url`, decode + resize + re-encode to WebP under the role's byte cap.
 * - `error`  → could not fetch or decode (never overwrite an existing good blob).
 * - `too_big`→ decoded fine but couldn't get under the cap.
 * - `ok`     → compressed bytes ready to store.
 */
export async function captureImage(url: string, role: ImageRole): Promise<CaptureResult> {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.gallery;

  const fetched = await fetchImageGuarded(url);
  if (!fetched) return { status: "error" };

  // SVG must be rasterized at higher density to look sharp.
  const isSvg =
    (fetched.contentType?.includes("svg") ?? false) ||
    fetched.bytes.slice(0, 256).toString("utf8").toLowerCase().includes("<svg");

  let base: sharp.Sharp;
  let meta: sharp.Metadata;
  try {
    base = sharp(fetched.bytes, {
      animated: false, // first frame of animated GIF/WebP
      ...(isSvg ? { density: 200 } : {}),
    });
    meta = await base.metadata();
    if (!meta.width || !meta.height) return { status: "error" };
  } catch {
    return { status: "error" };
  }

  const pipeline = base
    .rotate() // honor EXIF orientation
    .resize({
      width: cfg.maxDim,
      height: cfg.maxDim,
      fit: "inside",
      withoutEnlargement: true,
    });

  for (const quality of QUALITY_STEPS) {
    try {
      const out = await pipeline
        .clone()
        .webp({ quality, effort: 4, alphaQuality: 90 })
        .toBuffer({ resolveWithObject: true });
      if (out.data.byteLength <= cfg.capBytes) {
        return {
          status: "ok",
          bytes: out.data,
          mime: "image/webp",
          width: out.info.width ?? null,
          height: out.info.height ?? null,
          size: out.data.byteLength,
          etag: createHash("sha256").update(out.data).digest("hex"),
        };
      }
    } catch {
      return { status: "error" };
    }
  }

  return { status: "too_big" };
}
