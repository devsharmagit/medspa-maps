import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { promoteUnmatched } from "@/lib/admin/queue";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const categorySchema = z.enum([
  "Injectables",
  "Skin",
  "Laser",
  "Body",
  "Wellness",
  "Hair",
  "Other",
]);

const promoteSchema = z.object({
  rawName: z.string().min(1, "rawName is required"),
  name: z.string().min(1, "name is required"),
  slug: z.string().optional(),
  category: categorySchema.optional(),
});

// POST /api/admin/unmatched/promote — create a new pending canonical service from a raw name
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { rawName, name, slug, category } = promoteSchema.parse(body);

    const result = await promoteUnmatched(rawName, { name, slug, category });

    return successResponse(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
