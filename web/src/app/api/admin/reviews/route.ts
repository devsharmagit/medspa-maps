import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

const createReviewSchema = z.object({
  clinic_id: z.uuid("clinic_id must be a valid UUID"),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  body: z.string().min(1, "Review body is required"),
  reviewer_name: z.string().max(255).nullable().optional(),
  source: z.string().max(50).optional(),
  is_approved: z.boolean().optional(),
});

interface Review {
  id: string;
  clinic_id: string | null;
  rating: number | null;
  body: string | null;
  reviewer_name: string | null;
  source: string;
  source_url: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// GET /api/admin/reviews — list reviews, optional ?clinicId filter
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const clinicId = req.nextUrl.searchParams.get("clinicId");

    const reviews = clinicId
      ? await query<Review>(
          `SELECT id, clinic_id, rating, body, reviewer_name, source, source_url,
                  is_approved, is_active, created_at, updated_at
             FROM reviews
            WHERE clinic_id = $1
            ORDER BY created_at DESC`,
          [clinicId]
        )
      : await query<Review>(
          `SELECT id, clinic_id, rating, body, reviewer_name, source, source_url,
                  is_approved, is_active, created_at, updated_at
             FROM reviews
            ORDER BY created_at DESC`
        );

    return successResponse(reviews);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/admin/reviews — create an internal review
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const data = createReviewSchema.parse(body);

    const rows = await query<Review>(
      `INSERT INTO reviews (clinic_id, rating, body, reviewer_name, source, is_approved, data_source)
       VALUES ($1, $2, $3, $4, $5, $6, 'internal')
       RETURNING id, clinic_id, rating, body, reviewer_name, source, source_url,
                 is_approved, is_active, created_at, updated_at`,
      [
        data.clinic_id,
        data.rating ?? null,
        data.body,
        data.reviewer_name ?? null,
        data.source ?? "internal",
        data.is_approved ?? true,
      ]
    );

    return successResponse(rows[0], 201);
  } catch (err) {
    return handleApiError(err);
  }
}
