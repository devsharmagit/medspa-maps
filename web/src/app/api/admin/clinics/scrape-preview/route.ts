import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";
import { scrapeClinicPreview } from "@/lib/admin/scrape-preview";

const previewSchema = z.object({
  url: z.url("Must be a valid URL"),
});

// POST /api/admin/clinics/scrape-preview
// Scrape a website into a save-ready preview payload (+ duplicate block).
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { url } = previewSchema.parse(body);

    let preview;
    try {
      preview = await scrapeClinicPreview(url);
    } catch {
      // Bad / unreachable URL — surface a clean 422 instead of a 500.
      throw ApiError.unprocessable(
        "Could not scrape that URL. Check that the address is correct and reachable."
      );
    }

    return successResponse(preview);
  } catch (err) {
    return handleApiError(err);
  }
}
