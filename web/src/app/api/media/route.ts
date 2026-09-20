import { NextRequest, NextResponse } from "next/server";
import { getStoredBlobByUrl } from "@/lib/media/blobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLACEHOLDER = "/images/placeholder-clinic.svg";
const FALLBACK_ENABLED = process.env.MEDIA_FALLBACK_ENABLED !== "false";

// GET /api/media?u=<encoded source url>
// Returns our stored fallback copy of an image, looked up by the URL the page
// rendered. Never fetches `u` (not an open proxy). On a miss → 302 placeholder.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");

  const miss = () =>
    NextResponse.redirect(new URL(PLACEHOLDER, req.nextUrl.origin), {
      status: 302,
      headers: { "Cache-Control": "public, max-age=300" },
    });

  if (!FALLBACK_ENABLED || !u) return miss();

  let stored;
  try {
    stored = await getStoredBlobByUrl(u);
  } catch {
    return miss();
  }
  if (!stored) return miss();

  const etag = stored.etag ? `"${stored.etag}"` : undefined;
  if (etag && req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  const headers: Record<string, string> = {
    "Content-Type": stored.mime,
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
  };
  if (etag) headers.ETag = etag;

  // Copy into a standalone Blob for a well-typed Response body.
  const body = new Blob([new Uint8Array(stored.bytes)], { type: stored.mime });
  return new NextResponse(body, { status: 200, headers });
}
