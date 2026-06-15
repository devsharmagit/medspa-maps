import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";
import { query } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";

const createBusinessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(255),
  website_url: z.url("Must be a valid URL"),
});

interface Business {
  id: string;
  name: string;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
}

// GET /api/admin/businesses
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw ApiError.unauthorized();

    const businesses = await query<Business>(
      "SELECT id, name, website_url, is_active, created_at FROM businesses ORDER BY created_at DESC"
    );

    return successResponse(businesses);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/admin/businesses
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw ApiError.unauthorized();

    const body = await req.json();
    const { name, website_url } = createBusinessSchema.parse(body);

    const rows = await query<Business>(
      `INSERT INTO businesses (name, website_url)
       VALUES ($1, $2)
       RETURNING id, name, website_url, is_active, created_at`,
      [name, website_url]
    );

    return successResponse(rows[0], 201);
  } catch (err) {
    // Postgres unique-violation code
    if ((err as { code?: string }).code === "23505") {
      return handleApiError(ApiError.conflict("A business with that website URL already exists"));
    }
    return handleApiError(err);
  }
}
