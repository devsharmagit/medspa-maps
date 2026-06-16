/**
 * POST /api/internal/scrape
 * Body: { url: string }
 *
 * Runs the Cheerio scraper on the given URL and returns structured JSON.
 * Used by the cron server and admin UI to scrape any clinic website.
 * Does NOT write to the DB — caller decides what to save.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { scrapeWebsite } from "@/lib/scraper";

export async function POST(req: Request): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const body = await req.json() as { url?: string };
  if (!body.url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  const result = await scrapeWebsite(body.url);
  return Response.json({ ok: true, result });
}
