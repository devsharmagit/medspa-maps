import type { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-response";
import pool from "@/lib/db";
import { rateLimit } from "@/lib/chat/rate-limit";
import { resolveProviderExpertise, type ProviderExpertiseRow } from "@/lib/providers/expertise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// On-demand generation costs an OpenAI call + a scrape, so cap per IP.
const RATE_LIMIT_MAX = Number(process.env.PROVIDER_SUMMARY_RATE_LIMIT) || 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || null;
}

// GET /api/providers/[id]/expertise — cached expertise summary, or scrape the
// clinic site + AI-summarize + cache on a miss. The heavy lifting (discovery,
// extraction, summarize, cache) lives in `@/lib/providers/expertise` so the
// pre-warm backfill can reuse the exact same logic.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const ip = getClientIp(req);
    const limit = rateLimit(`provider-expertise:${ip ?? "unknown"}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.ok) {
      return errorResponse("Too many requests. Please try again shortly.", 429);
    }

    const { rows } = await pool.query<ProviderExpertiseRow>(
      `SELECT p.id, p.name, p.title, p.card_tagline, p.source_url, p.expertise_summary,
              c.website, c.slug AS clinic_slug
         FROM providers p
         JOIN clinics c ON c.id = p.clinic_id
        WHERE p.id = $1 AND p.is_active = true`,
      [id]
    );
    const provider = rows[0];
    if (!provider) return errorResponse("Provider not found", 404);

    const result = await resolveProviderExpertise(provider);
    return successResponse(result);
  } catch (err) {
    if (err instanceof Error && err.message.includes("OPENAI_API_KEY")) {
      return errorResponse("AI is not configured.", 503);
    }
    return errorResponse("Failed to load provider expertise.", 500);
  }
}
