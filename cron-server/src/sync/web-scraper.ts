/**
 * Scrapes phone and social links from non-G99 business websites.
 * Runs in parallel batches of BATCH_SIZE — network I/O is the bottleneck,
 * so parallel fetching gives the biggest speedup here.
 * Scraped data is sent to Next.js to write — this server never touches the DB.
 */

import * as cheerio from "cheerio";
import { getNonG99Businesses, updateBusinessScraped } from "../api-client";
import { runInBatches } from "../batch";

const BATCH_SIZE = 5;

export async function runWebScraper(): Promise<void> {
  console.log("── Non-G99 Scraper started ───────────────────────────────────");

  const businesses = await getNonG99Businesses();
  console.log(`  ${businesses.length} non-G99 businesses to refresh`);
  console.log(`  running in batches of ${BATCH_SIZE}\n`);

  const results = await runInBatches(businesses, BATCH_SIZE, scrapeBusiness);

  const ok = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;

  console.log(`\n── Non-G99 Scraper complete — ${ok} ok, ${failed} failed ─────\n`);
}

async function scrapeBusiness(biz: {
  id: string;
  name: string;
  website_url: string;
}): Promise<void> {
  try {
    const res = await fetch(biz.website_url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "MedSpaMaps-Bot/1.0" },
    });
    if (!res.ok) {
      console.log(`  ✗ ${biz.name} — HTTP ${res.status}`);
      return;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    let phone: string | null = null;
    $("a[href^='tel:']").each((_, el) => {
      if (!phone) phone = $(el).attr("href")!.replace("tel:", "").trim();
    });
    if (!phone) {
      const m = html.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/);
      if (m) phone = m[0];
    }

    let instagram: string | null = null;
    let facebook: string | null = null;
    $("a[href*='instagram.com']").each((_, el) => {
      if (!instagram) instagram = $(el).attr("href") ?? null;
    });
    $("a[href*='facebook.com']").each((_, el) => {
      if (!facebook) facebook = $(el).attr("href") ?? null;
    });

    if (phone || instagram || facebook) {
      await updateBusinessScraped(biz.id, {
        phone,
        instagram_url: instagram,
        facebook_url: facebook,
      });
    }

    console.log(`  ✓ ${biz.name}`);
  } catch (err) {
    console.log(`  ✗ ${biz.name} — ${(err as Error).message}`);
    throw err; // let runInBatches record this as an error
  }
}
