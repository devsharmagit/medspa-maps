import { NextResponse } from "next/server";
import { ApiError } from "./errors";
import { ZodError } from "zod";

// ── Canonical response shape ─────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  error: null;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiFailure;

// ── Response builders ────────────────────────────────────────────────────────

export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data, error: null }, { status });
}

export function errorResponse(message: string, status = 500): NextResponse<ApiFailure> {
  return NextResponse.json({ success: false, data: null, error: message }, { status });
}

// ── Central error handler — use inside every route catch block ───────────────

export function handleApiError(err: unknown): NextResponse<ApiFailure> {
  if (err instanceof ApiError) {
    return errorResponse(err.message, err.statusCode);
  }

  if (err instanceof ZodError) {
    const message = err.issues.map((e) => e.message).join("; ");
    return errorResponse(message, 422);
  }

  if (err instanceof Error) {
    console.error("[API Error]", err);
    return errorResponse("Internal server error", 500);
  }

  console.error("[API Error] Unknown error", err);
  return errorResponse("Internal server error", 500);
}
