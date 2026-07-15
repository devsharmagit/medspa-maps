import crypto from "node:crypto";
import pool from "@/lib/db";
import type {
  NavigatorAnalysis,
  NavigatorClinicMatch,
  NavigatorRequest,
} from "./schema";

export interface CreateNavigatorSessionInput {
  request: NavigatorRequest;
  analysis?: NavigatorAnalysis;
  clinics?: NavigatorClinicMatch[];
  photoCount: number;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
  latencyMs?: number;
  errorCode?: string;
  ip?: string;
  userAgent?: string | null;
}

function hashIp(ip: string | undefined): string | null {
  if (!ip || ip === "unknown") return null;
  const salt = process.env.NAVIGATOR_IP_HASH_SALT || process.env.NEXTAUTH_SECRET || "medspa-map";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function isMissingTableError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42P01"
  );
}

export async function createNavigatorSession(
  input: CreateNavigatorSessionInput
): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO ai_navigator_sessions (
         ip_hash,
         user_agent,
         request,
         photo_count,
         vision_included,
         ai_response,
         matched_clinic_ids,
         model,
         input_tokens,
         output_tokens,
         latency_ms,
         error_code
       )
       VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7::uuid[], $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        hashIp(input.ip),
        input.userAgent ?? null,
        JSON.stringify(input.request),
        input.photoCount,
        input.photoCount > 0,
        input.analysis ? JSON.stringify(input.analysis) : null,
        input.clinics?.map((c) => c.clinicId) ?? [],
        input.model ?? null,
        input.usage?.input_tokens ?? null,
        input.usage?.output_tokens ?? null,
        input.latencyMs ?? null,
        input.errorCode ?? null,
      ]
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    if (isMissingTableError(err)) {
      console.warn("[skin-navigator] persistence skipped; ai_navigator_sessions is missing");
      return null;
    }
    throw err;
  }
}
