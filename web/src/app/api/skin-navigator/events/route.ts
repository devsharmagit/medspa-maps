import type { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-response";
import { recordNavigatorEvent } from "@/lib/skin-navigator/analytics";
import { NavigatorEventSchema } from "@/lib/skin-navigator/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = NavigatorEventSchema.parse(body);
    await recordNavigatorEvent(event);
    return successResponse({ recorded: true });
  } catch (err) {
    console.error("[skin-navigator] event error:", err);
    return errorResponse("Unable to record navigator event.", 400);
  }
}
