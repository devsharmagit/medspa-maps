/**
 * check-scrape.ts — isolated heuristic scraper check (no DB, no LLM/API key).
 *
 *   bun scripts/check-scrape.ts [domain ...]
 *
 * Fetches each site and prints what the heuristic extractors find for images
 * (logo / cover / gallery), the booking URL, and working hours — the pieces the
 * AI ingest pipeline relies on. Defaults to the three fix-verification domains.
 */

import { fetchHtml, load, normalizeUrl } from "../src/lib/scraper/utils";
import { extractImages } from "../src/lib/scraper/images";
import { extractBookingUrl, extractHours } from "../src/lib/scraper/contact";

const DEFAULTS = [
  "germaindermatology.com",
  "bareskin-wellness.com",
  "88aestheticandwellness.com",
];

async function check(domain: string) {
  const url = normalizeUrl(domain);
  console.log(`\n══ ${domain} ══`);
  const res = await fetchHtml(url);
  if (!res) {
    console.log("  ✗ unreachable");
    return;
  }
  const $ = load(res.html);
  const finalUrl = res.finalUrl || url;

  const imgs = extractImages($, finalUrl);
  const cover = imgs.find((i) => i.role === "cover");
  const logo = imgs.find((i) => i.role === "logo");
  const gallery = imgs.filter((i) => i.role === "gallery");

  console.log(`  logo   : ${logo?.source_url ?? "—"}`);
  console.log(`  cover  : ${cover?.source_url ?? "—"}  (score=${cover?.match_score ?? "-"})`);
  console.log(`  gallery: ${gallery.length}`);
  gallery.slice(0, 6).forEach((g) => console.log(`           - ${g.source_url}`));
  console.log(`  booking: ${extractBookingUrl($, finalUrl) ?? "—"}`);

  const hours = extractHours($, res.html);
  if (hours) {
    for (const [day, h] of Object.entries(hours)) {
      console.log(`  ${day.padEnd(10)} ${h.is_open ? `${h.open}–${h.close}` : "Closed"}`);
    }
  } else {
    console.log("  hours  : —");
  }
}

async function main() {
  const domains = process.argv.slice(2);
  for (const d of domains.length ? domains : DEFAULTS) await check(d);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
