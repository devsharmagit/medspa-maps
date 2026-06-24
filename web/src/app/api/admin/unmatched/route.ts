import { requireAdmin } from "@/lib/admin/auth";
import { listUnmatched } from "@/lib/admin/queue";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

// GET /api/admin/unmatched — the review queue (real services first, noise flagged)
export async function GET() {
  try {
    await requireAdmin();
    const items = await listUnmatched();
    return successResponse(items);
  } catch (err) {
    return handleApiError(err);
  }
}
