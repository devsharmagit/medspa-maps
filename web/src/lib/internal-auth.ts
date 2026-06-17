/**
 * Shared auth check for all /api/internal/* routes.
 * Cron server must send: X-Internal-Secret: <INTERNAL_API_SECRET>
 */
export function isInternalAuthorized(req: Request): boolean {
  const header = req.headers.get("x-internal-secret");
  const secret = process.env.INTERNAL_API_SECRET;
  console.log(`[auth check] header: ${header}, env: ${secret}`);
  return header === secret;
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
