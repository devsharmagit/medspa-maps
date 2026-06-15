import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";
import { queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";

const patchSchema = z.object({
  is_active: z.boolean(),
});

interface Business {
  id: string;
  name: string;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/admin/businesses/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw ApiError.unauthorized();

    const { id } = await params;

    const deleted = await queryOne<Business>(
      "DELETE FROM businesses WHERE id = $1 RETURNING id, name",
      [id]
    );

    if (!deleted) throw ApiError.notFound("Business not found");

    return successResponse({ id: deleted.id, name: deleted.name });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/admin/businesses/[id]
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw ApiError.unauthorized();

    const { id } = await params;
    const body = await req.json();
    const { is_active } = patchSchema.parse(body);

    const updated = await queryOne<Business>(
      `UPDATE businesses
       SET is_active = $1
       WHERE id = $2
       RETURNING id, name, website_url, is_active, created_at`,
      [is_active, id]
    );

    if (!updated) throw ApiError.notFound("Business not found");

    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
