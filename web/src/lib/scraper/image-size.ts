/**
 * scraper/image-size.ts — cheap image-dimension probing for cover selection.
 *
 * The clinic cover renders in a landscape hero slot, so a portrait photo (e.g. a
 * 706x1024 "welcome pic") must never be picked. Dimensions come from, in order:
 *   1. a WxH token in the filename (WordPress resized files: "...-706x1024.webp")
 *      — free, no network;
 *   2. parsing the image header bytes (PNG/JPEG/GIF/WebP) from a bounded fetch.
 *
 * Everything degrades to null ("unknown") rather than throwing — callers treat
 * unknown as acceptable so a flaky host can't wipe out the cover entirely.
 */

export interface ImageDims {
  w: number;
  h: number;
}

/** WxH from a WordPress-style resize suffix in the filename ("-706x1024.webp"). */
export function dimsFromUrl(url: string): ImageDims | null {
  const file = (url.split("/").pop() ?? "").split(/[?#]/)[0];
  const m = file.match(/(?:^|[-_.])(\d{2,5})x(\d{2,5})(?:[-_.@]|\.[a-z0-9]+$)/i);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  // Guard against version-ish tokens ("2x3", dates); real resize dims are ≥50px.
  if (w < 50 || h < 50 || w > 20000 || h > 20000) return null;
  return { w, h };
}

// ── header parsers (all return null when the signature doesn't match) ────────

const ascii = (b: Uint8Array, off: number, len: number) =>
  String.fromCharCode(...b.subarray(off, off + len));

function pngDims(b: Uint8Array): ImageDims | null {
  if (b.length < 24) return null;
  if (b[0] !== 0x89 || ascii(b, 1, 3) !== "PNG") return null;
  const dv = new DataView(b.buffer, b.byteOffset);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

function gifDims(b: Uint8Array): ImageDims | null {
  if (b.length < 10 || ascii(b, 0, 3) !== "GIF") return null;
  return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) };
}

function jpegDims(b: Uint8Array): ImageDims | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    // standalone markers without a length payload
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01 || marker === 0xff) {
      i += 2;
      continue;
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    // SOF0..SOF15 minus DHT(C4)/JPG(C8)/DAC(CC) carry the frame dimensions.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    }
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function webpDims(b: Uint8Array): ImageDims | null {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const fourcc = ascii(b, 12, 4);
  if (fourcc === "VP8X") {
    // extended: 24-bit little-endian canvas size minus one
    const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { w, h };
  }
  if (fourcc === "VP8 ") {
    // lossy: sync code 9D 01 2A then 14-bit LE dims
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  if (fourcc === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const w = 1 + (b[21] | ((b[22] & 0x3f) << 8));
    const h = 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10));
    return { w, h };
  }
  return null;
}

function parseDims(b: Uint8Array): ImageDims | null {
  return pngDims(b) ?? gifDims(b) ?? webpDims(b) ?? jpegDims(b) ?? null;
}

/** Fetch just enough of the image to read its header (JPEG SOF can sit late,
 *  so grab up to 128 KB) and parse the dimensions. null = unknown/unreachable. */
export async function fetchImageDims(url: string): Promise<ImageDims | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Range: "bytes=0-131071",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return parseDims(buf);
  } catch {
    return null;
  }
}

/** Dimensions via filename token first, then header fetch. null = unknown. */
export async function probeImageDims(url: string): Promise<ImageDims | null> {
  return dimsFromUrl(url) ?? (await fetchImageDims(url));
}

/**
 * Cover-slot suitability: landscape-or-square-ish (w/h ≥ minRatio, default 1 —
 * i.e. at least as wide as tall) and not a tiny thumbnail.
 * Returns true / false / null (unknown — caller decides how to treat it).
 */
export async function isLandscapeImage(
  url: string,
  opts: { minRatio?: number; minWidth?: number } = {}
): Promise<boolean | null> {
  const dims = await probeImageDims(url);
  if (!dims || dims.w <= 0 || dims.h <= 0) return null;
  const minRatio = opts.minRatio ?? 1;
  const minWidth = opts.minWidth ?? 400;
  return dims.w / dims.h >= minRatio && dims.w >= minWidth;
}
