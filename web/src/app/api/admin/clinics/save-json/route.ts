import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";
import { saveClinicFromPayload, type ClinicJsonPayload } from "@/lib/admin/save-payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/admin/clinics/save-json
// Body: { payload: <clinic json> } OR { payloads: [<clinic json>, ...] }, plus
// optional { overwrite: boolean }. Runs the no-OpenAI save engine through the
// app's DB role — the same one /admin/add-website writes with.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const overwrite = Boolean(body?.overwrite);

    const payloads: unknown[] = Array.isArray(body?.payloads)
      ? body.payloads
      : body?.payload != null
        ? [body.payload]
        : Array.isArray(body)
          ? body
          : [];

    if (payloads.length === 0) {
      throw ApiError.badRequest("Provide `payload` (one clinic) or `payloads` (an array).");
    }
    if (payloads.length > 25) {
      throw ApiError.badRequest("Too many payloads in one request (max 25).");
    }

    const results = [];
    for (const p of payloads) {
      if (!p || typeof p !== "object") {
        results.push({ domain: null, status: "failed", note: "not an object" });
        continue;
      }
      try {
        results.push(await saveClinicFromPayload(p as ClinicJsonPayload, { overwrite }));
      } catch (err) {
        results.push({
          domain: (p as ClinicJsonPayload).website ?? null,
          status: "failed",
          note: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const saved = results.filter((r) => r.status === "saved").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "failed").length;
    return successResponse({ saved, skipped, failed, results });
  } catch (err) {
    return handleApiError(err);
  }
}
