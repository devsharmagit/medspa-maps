import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export interface PatientLead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: "search" | "skin_navigator";
  treatment: string | null;
  concern: string | null;
  location: string | null;
  skin_navigator: unknown | null;
  status: "new" | "contacted" | "qualified" | "converted" | "rejected";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const LEAD_COLUMNS = `id, first_name, last_name, email, phone, source,
  treatment, concern, location, skin_navigator, status, notes,
  created_at, updated_at`;

// GET /api/admin/leads — list patient leads, optional ?status and ?source filters
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const status = req.nextUrl.searchParams.get("status");
    const source = req.nextUrl.searchParams.get("source");

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (source) {
      params.push(source);
      conditions.push(`source = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const leads = await query<PatientLead>(
      `SELECT ${LEAD_COLUMNS}
         FROM patient_leads
         ${where}
        ORDER BY created_at DESC`,
      params
    );

    return successResponse(leads);
  } catch (err) {
    return handleApiError(err);
  }
}
