import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import { errorResponse, successResponse } from "@/lib/api-response";
import { rateLimit } from "@/lib/chat/rate-limit";
import { analyzeTreatmentNavigator, type NavigatorPhotoInput } from "@/lib/skin-navigator/ai";
import { matchNavigatorClinics } from "@/lib/skin-navigator/clinic-match";
import { createNavigatorSession } from "@/lib/skin-navigator/sessions";
import {
  NAVIGATOR_DISCLAIMER,
  NavigatorRequestSchema,
  type NavigatorAnalyzeResponse,
} from "@/lib/skin-navigator/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

async function readPhoto(form: FormData, key: string, label: string): Promise<NavigatorPhotoInput | null> {
  const value = form.get(key);
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error("Each photo must be 5 MB or smaller."), {
      status: 413,
    });
  }
  if (!ALLOWED_IMAGE_TYPES.has(value.type)) {
    throw Object.assign(new Error("Photos must be JPEG, PNG, or WebP images."), {
      status: 400,
    });
  }

  const buffer = Buffer.from(await value.arrayBuffer());
  return {
    label,
    mediaType: value.type,
    base64: buffer.toString("base64"),
  };
}

function httpStatusFromError(err: unknown): number {
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
  ) {
    return (err as { status: number }).status;
  }
  if (err instanceof ZodError) return 422;
  if (err instanceof Error && err.message.includes("OPENAI_API_KEY")) return 503;
  if (err instanceof Error && err.message.startsWith("OpenAI")) return 502;
  return 500;
}

function userMessageFromError(err: unknown): string {
  if (err instanceof ZodError) return "Please check your answers and try again.";
  if (err instanceof Error && err.message.includes("OPENAI_API_KEY")) {
    return "The AI Treatment Navigator is not configured yet.";
  }
  if (err instanceof Error && err.message.startsWith("OpenAI")) {
    return "The AI service is temporarily unavailable. Please try again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`skin-navigator:${ip}`, 8, 60 * 60 * 1000);
  if (!rl.ok) {
    return errorResponse(
      `You're trying the navigator quickly. Please wait ${rl.retryAfter}s and try again.`,
      429
    );
  }

  const startedAt = Date.now();
  let parsedRequest: ReturnType<typeof NavigatorRequestSchema.parse> | null = null;
  let photoCount = 0;

  try {
    const form = await req.formData();
    const rawPayload = form.get("payload");
    if (typeof rawPayload !== "string") {
      return errorResponse("Missing navigator answers.", 400);
    }

    parsedRequest = NavigatorRequestSchema.parse(JSON.parse(rawPayload));
    const photos = (
      await Promise.all([
        readPhoto(form, "photo", "Face photo"),
        readPhoto(form, "frontPhoto", "Face photo"),
      ])
    ).filter((photo): photo is NavigatorPhotoInput => Boolean(photo)).slice(0, 1);
    photoCount = photos.length;

    const aiResult = await analyzeTreatmentNavigator(parsedRequest, photos);
    const clinics = await matchNavigatorClinics(parsedRequest, aiResult.analysis);
    const sessionId = await createNavigatorSession({
      request: parsedRequest,
      analysis: aiResult.analysis,
      clinics,
      photoCount,
      model: aiResult.model,
      usage: aiResult.usage,
      latencyMs: Date.now() - startedAt,
      ip,
      userAgent: req.headers.get("user-agent"),
    });

    const data: NavigatorAnalyzeResponse = {
      sessionId,
      analysis: aiResult.analysis,
      clinics,
      disclaimer: aiResult.analysis.disclaimer || NAVIGATOR_DISCLAIMER,
    };

    return successResponse(data);
  } catch (err) {
    console.error("[skin-navigator] analyze error:", err);
    if (parsedRequest) {
      await createNavigatorSession({
        request: parsedRequest,
        photoCount,
        latencyMs: Date.now() - startedAt,
        errorCode: httpStatusFromError(err).toString(),
        ip,
        userAgent: req.headers.get("user-agent"),
      }).catch((persistErr) => {
        console.error("[skin-navigator] failed to persist error session:", persistErr);
      });
    }
    return errorResponse(userMessageFromError(err), httpStatusFromError(err));
  }
}
