import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";
import { resolveClinicRating } from "@/lib/ratings/fetch-rating";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RatingLookupRow {
  name: string;
  website: string | null;
  google_place_id: string | null;
  city: string | null;
  state: string | null;
}

// GET /api/admin/clinics/[id]/rating
// Fetches the aggregated rating + review count from the clinic website
// (schema.org) or Google Places. Does NOT persist — the numbers are returned so
// the edit form can stage them and save them via the clinic PATCH.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const row = await queryOne<RatingLookupRow>(
      `SELECT c.name,
              c.website,
              c.google_place_id,
              loc.city,
              loc.state
         FROM clinics c
         LEFT JOIN LATERAL (
           SELECT city, state
             FROM clinic_locations
            WHERE clinic_id = c.id AND is_active = true
            ORDER BY is_primary DESC, sort_order, created_at
            LIMIT 1
         ) loc ON true
        WHERE c.id = $1`,
      [id]
    );

    if (!row) throw ApiError.notFound("Clinic not found");

    const query = [row.name, row.city, row.state].filter(Boolean).join(", ") || null;

    const result = await resolveClinicRating({
      website: row.website,
      placeId: row.google_place_id,
      query,
    });

    if (!result) {
      return successResponse({
        found: false,
        message:
          "No rating found from the website or Google Places. Check that GOOGLE_PLACES_API_KEY is configured and the clinic has a Google place.",
      });
    }

    return successResponse({
      found: true,
      rating: result.rating,
      reviewCount: result.reviewCount,
      source: result.source,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
