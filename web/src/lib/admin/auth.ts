/**
 * admin/auth.ts — shared admin authentication for admin server libs + routes.
 *
 * Mirrors the existing protected admin routes (src/app/api/admin/*), which call
 * getServerSession(authOptions) and throw ApiError.unauthorized() when there is
 * no session. This centralizes that check so route handlers and server actions
 * can share one helper instead of repeating it.
 */

import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ApiError } from "@/lib/errors";

/**
 * requireAdmin() — reads the next-auth server session and returns it, or throws
 * ApiError.unauthorized() (401) when there is no authenticated admin. Use at the
 * top of any admin server action / route handler.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session) throw ApiError.unauthorized();
  return session;
}

/**
 * isAdminRequest() — non-throwing variant. Returns true when an admin session
 * exists. Handy for conditional UI / soft checks.
 */
export async function isAdminRequest(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return Boolean(session);
}
