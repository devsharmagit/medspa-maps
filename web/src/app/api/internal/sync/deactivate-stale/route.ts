import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import pool from "@/lib/db";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  let body: { seenClinicIds: number[]; seenBusinessIds: number[] };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { seenClinicIds, seenBusinessIds } = body;
  if (!Array.isArray(seenClinicIds) || !Array.isArray(seenBusinessIds)) {
    return errorResponse("seenClinicIds and seenBusinessIds must be arrays", 400);
  }

  try {
    const clinicResult = await pool.query(
      seenClinicIds.length > 0
        ? `UPDATE clinics SET is_active = false, updated_at = NOW()
           WHERE data_source = 'g99'
             AND is_active = true
             AND g99_clinic_id IS NOT NULL
             AND g99_clinic_id <> ALL($1::bigint[])`
        : `UPDATE clinics SET is_active = false, updated_at = NOW()
           WHERE data_source = 'g99'
             AND is_active = true
             AND g99_clinic_id IS NOT NULL`,
      seenClinicIds.length > 0 ? [seenClinicIds] : []
    );

    const businessResult = await pool.query(
      seenBusinessIds.length > 0
        ? `UPDATE businesses SET is_active = false, updated_at = NOW()
           WHERE data_source = 'g99'
             AND is_active = true
             AND g99_business_id IS NOT NULL
             AND g99_business_id <> ALL($1::bigint[])`
        : `UPDATE businesses SET is_active = false, updated_at = NOW()
           WHERE data_source = 'g99'
             AND is_active = true
             AND g99_business_id IS NOT NULL`,
      seenBusinessIds.length > 0 ? [seenBusinessIds] : []
    );

    return successResponse({
      clinics_deactivated: clinicResult.rowCount ?? 0,
      businesses_deactivated: businessResult.rowCount ?? 0,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
