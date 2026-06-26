import { NextRequest } from "next/server";
import { getConcernData } from "@/lib/concerns/queries";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/concerns/[slug]
 *
 * Concern page payload: concern + services + before/after + clinics that
 * offer it (derived) + reviews from those clinics (derived).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const data = await getConcernData(slug);
    if (!data) return errorResponse("Concern not found", 404);
    return successResponse({
      ...data,
      counts: {
        services: data.services.length,
        clinics: data.clinics.length,
        beforeAfter: data.beforeAfter.length,
        reviews: data.reviews.length,
        providers: data.providers.length,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
