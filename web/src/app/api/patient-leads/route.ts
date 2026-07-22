import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, handleApiError, successResponse } from "@/lib/api-response";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatientLeadSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(120),
  lastName: z.string().trim().min(1, "Last name is required").max(120),
  email: z.string().trim().email("Enter a valid email address").max(255),
  phone: z.string().trim().min(5, "Enter a valid phone number").max(40),
  source: z.enum(["search", "skin_navigator"]).default("search"),
  treatment: z.string().trim().max(255).optional().nullable(),
  concern: z.string().trim().max(255).optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  // Free-form navigator questionnaire payload (basics/goals/preferences).
  skinNavigator: z.unknown().optional().nullable(),
});

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lead = PatientLeadSchema.parse(body);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO patient_leads
         (first_name, last_name, email, phone, source,
          treatment, concern, location, skin_navigator, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
       RETURNING id`,
      [
        lead.firstName,
        lead.lastName,
        lead.email,
        lead.phone,
        lead.source,
        lead.treatment || null,
        lead.concern || null,
        lead.location || null,
        lead.skinNavigator == null ? null : JSON.stringify(lead.skinNavigator),
        getClientIp(req),
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
