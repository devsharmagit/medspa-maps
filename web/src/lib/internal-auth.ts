/**
 * Shared auth check for all /api/internal/* routes.
 * Cron server must send: X-Internal-Secret: <INTERNAL_API_SECRET>
 */
export function isInternalAuthorized(req: Request): boolean {
  return req.headers.get("x-internal-secret") === process.env.INTERNAL_API_SECRET;
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
