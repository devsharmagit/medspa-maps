import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export interface ClinicLead {
  id: string;
  full_name: string;
  business_email: string;
  business_name: string;
  status: "new" | "contacted" | "qualified" | "converted" | "rejected";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const CLINIC_LEAD_COLUMNS = `id, full_name, business_email, business_name,
  status, notes, created_at, updated_at`;

// GET /api/admin/clinic-leads — list "List your medspa" submissions, optional ?status filter
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const status = req.nextUrl.searchParams.get("status");

    const params: unknown[] = [];
    let where = "";
    if (status) {
      params.push(status);
      where = `WHERE status = $${params.length}`;
    }

    const leads = await query<ClinicLead>(
      `SELECT ${CLINIC_LEAD_COLUMNS}
         FROM clinic_leads
         ${where}
        ORDER BY created_at DESC`,
      params
    );

    return successResponse(leads);
  } catch (err) {
    return handleApiError(err);
  }
}
