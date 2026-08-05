import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, successResponse } from "@/lib/api-response";
import pool from "@/lib/db";
import { rateLimit } from "@/lib/chat/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Max submissions per IP per window — this is a one-off correction request. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const requiredText = (message: string) => z.string({ error: message }).trim();

// The clinic is identified ONLY by its id (from the page). The visitor supplies
// their email + the change they want; they never type clinic details.
const RevisionRequestSchema = z.object({
  clinicId: z.string({ error: "Missing clinic" }).uuid("Missing clinic"),
  email: requiredText("Email is required")
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(255),
  name: z.string().trim().max(120).optional().nullable(),
  message: requiredText("Please describe what needs correcting")
    .min(5, "Please describe what needs correcting")
    .max(4000),
  // Honeypot: real users never see this field, bots fill everything.
  companyWebsiteHp: z.string().trim().max(255).optional().nullable(),
});

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || null;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(
      `clinic-revision:${ip ?? "unknown"}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!limit.ok) {
      return errorResponse("Too many submissions. Please try again in a few minutes.", 429);
    }

    const body = await req.json();
    const data = RevisionRequestSchema.parse(body);

    // Honeypot tripped — pretend it worked so the bot doesn't retry.
    if (data.companyWebsiteHp) {
      return successResponse({ id: null }, 201);
    }

    // Never trust client-supplied clinic details beyond the id: confirm it's a
    // real, active clinic before storing.
    const clinic = await pool.query<{ id: string }>(
      `SELECT id FROM clinics WHERE id = $1 AND is_active = true`,
      [data.clinicId],
    );
    if (clinic.rows.length === 0) {
      return errorResponse("Unknown clinic", 404);
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO clinic_revision_requests
         (clinic_id, requester_name, requester_email, message, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        data.clinicId,
        data.name || null,
        data.email,
        data.message,
        ip,
        req.headers.get("user-agent"),
      ],
    );

    return successResponse({ id: rows[0]?.id ?? null }, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return errorResponse("Invalid request body", 400);
    }
    return handleApiError(err);
  }
}
