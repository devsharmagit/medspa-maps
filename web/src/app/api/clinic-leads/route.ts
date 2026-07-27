import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, successResponse } from "@/lib/api-response";
import pool from "@/lib/db";
import { rateLimit } from "@/lib/chat/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Max submissions per IP per window — the form is a one-off signup, not a tool. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/** `error` covers the missing/wrong-type case, which .min() cannot report. */
const requiredText = (message: string) => z.string({ error: message }).trim();

// Contact info only. The visitor sees a "coming soon" message; nothing is routed
// to a sales team yet.
const ClinicLeadSchema = z.object({
  fullName: requiredText("Full name is required").min(1, "Full name is required").max(120),
  businessEmail: requiredText("Business email is required")
    .min(1, "Business email is required")
    .email("Enter a valid business email address")
    .max(255),
  businessName: requiredText("Business name is required")
    .min(1, "Business name is required")
    .max(255),
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
    const limit = rateLimit(`clinic-leads:${ip ?? "unknown"}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.ok) {
      return errorResponse(
        "Too many submissions. Please try again in a few minutes.",
        429
      );
    }

    const body = await req.json();
    const lead = ClinicLeadSchema.parse(body);

    // Honeypot tripped — pretend it worked so the bot doesn't retry.
    if (lead.companyWebsiteHp) {
      return successResponse({ id: null }, 201);
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO clinic_leads
         (full_name, business_email, business_name, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        lead.fullName,
        lead.businessEmail,
        lead.businessName,
        ip,
        req.headers.get("user-agent"),
      ]
    );

    return successResponse({ id: rows[0]?.id ?? null }, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return errorResponse("Invalid request body", 400);
    }
    return handleApiError(err);
  }
}
