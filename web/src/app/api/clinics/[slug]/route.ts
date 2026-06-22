import { NextRequest } from "next/server";
import { getClinicData } from "@/lib/clinics/queries";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const data = await getClinicData(slug);
    if (!data) {
      return errorResponse("Clinic not found", 404);
    }

    const { clinic, treatments, gallery, gallery_total, reviews, stats } = data;
    return successResponse({
      clinic,
      treatments,
      gallery,
      gallery_total,
      reviews,
      stats,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
