import { NextRequest } from "next/server";
import { getTreatmentData } from "@/lib/treatments/queries";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/services/[slug]
 *
 * Treatment page payload: the service + clinics that offer it (derived) +
 * reviews from those clinics. Accepts optional ?lat & ?lng to sort clinics
 * by distance.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const sp = req.nextUrl.searchParams;
    const latRaw = parseFloat(sp.get("lat") ?? "");
    const lngRaw = parseFloat(sp.get("lng") ?? "");
    const opts = {
      lat: Number.isNaN(latRaw) ? undefined : latRaw,
      lng: Number.isNaN(lngRaw) ? undefined : lngRaw,
    };

    const data = await getTreatmentData(slug, opts);
    if (!data) return errorResponse("Treatment not found", 404);

    return successResponse({
      service: data.service,
      clinics: data.clinics,
      reviews: data.reviews,
      counts: {
        clinics: data.clinics.length,
        reviews: data.reviews.length,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
