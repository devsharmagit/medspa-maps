/**
 * Shared auth check for all /api/internal/* routes.
 * Cron server must send: X-Internal-Secret: <INTERNAL_API_SECRET>
 */
export function isInternalAuthorized(req: Request): boolean {
  const header = req.headers.get("x-internal-secret");
  const secret = process.env.INTERNAL_API_SECRET;
  // Never log the secret. Require a configured secret and a constant-ish compare.
  if (!secret || !header) return false;
  return header === secret;
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
