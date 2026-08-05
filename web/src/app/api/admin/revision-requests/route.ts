import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export type RevisionStatus = "new" | "reviewing" | "resolved" | "rejected";

export interface RevisionRequest {
  id: string;
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  requester_name: string | null;
  requester_email: string;
  message: string;
  status: RevisionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const REVISION_COLUMNS = `r.id, r.clinic_id, c.name AS clinic_name, c.slug AS clinic_slug,
  r.requester_name, r.requester_email, r.message, r.status, r.notes, r.created_at, r.updated_at`;

// GET /api/admin/revision-requests — practice-submitted listing corrections,
// ordered so the client can group them by clinic. Optional ?status filter.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const status = req.nextUrl.searchParams.get("status");
    const params: unknown[] = [];
    let where = "";
    if (status) {
      params.push(status);
      where = `WHERE r.status = $${params.length}`;
    }

    const rows = await query<RevisionRequest>(
      `SELECT ${REVISION_COLUMNS}
         FROM clinic_revision_requests r
         JOIN clinics c ON c.id = r.clinic_id
         ${where}
        ORDER BY c.name ASC, r.created_at DESC`,
      params
    );

    return successResponse(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
