import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { ignoreUnmatched } from "@/lib/admin/queue";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const ignoreSchema = z.object({
  rawName: z.string().min(1, "rawName is required"),
});

// POST /api/admin/unmatched/ignore — mark a raw name's rows as ignored
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { rawName } = ignoreSchema.parse(body);

    const result = await ignoreUnmatched(rawName);

    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}
