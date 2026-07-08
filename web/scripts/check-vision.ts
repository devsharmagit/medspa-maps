/**
 * check-vision.ts — isolated Claude-vision image-pick check (no DB writes).
 *
 *   bun --env-file=.env scripts/check-vision.ts [domain ...]
 *
 * Fetches each homepage, collects image candidates, then runs the AI extraction
 * WITH vision (Haiku) and prints the cover/logo/gallery it chose — plus the exact
 * error if the vision request itself fails (e.g. a hotlink-blocked image URL).
 * Needs ANTHROPIC_API_KEY. No DB connection.
 */

import { fetchHtml, load, normalizeUrl } from "../src/lib/scraper/utils";
import { collectImageCandidates } from "../src/lib/scraper/images";
import { extractClinicDetails } from "../src/lib/ingest/ai-extract";

const DEFAULTS = ["germaindermatology.com"];

async function check(domain: string) {
  console.log(`\n══ ${domain} ══`);
  const url = normalizeUrl(domain);
  const res = await fetchHtml(url);
  if (!res) return console.log("  ✗ unreachable");
  const $ = load(res.html);
  const finalUrl = res.finalUrl || url;
  const imageCandidates = collectImageCandidates($, finalUrl);
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
  console.log(`  candidates: ${imageCandidates.length}`);

  for (const useVision of [true, false]) {
    const tag = useVision ? "VISION" : "text-only";
    try {
      const { data, model, usage } = await extractClinicDetails({
        domain,
        pages: [{ url: finalUrl, text }],
        imageCandidates,
        useVision,
        // pin to the cheap model so we test the primary (Haiku) path, not escalation
        model: "claude-haiku-4-5",
      });
      console.log(`  [${tag}] model=${model} in=${usage?.input_tokens} out=${usage?.output_tokens}`);
      console.log(`    cover  : ${data.cover_image_url ?? "—"}`);
      console.log(`    logo   : ${data.logo_url ?? "—"}`);
      console.log(`    gallery: ${data.gallery_image_urls.length}`);
      data.gallery_image_urls.slice(0, 6).forEach((g) => console.log(`             - ${g}`));
    } catch (e) {
      console.log(`  [${tag}] ✗ ${e instanceof Error ? e.message : String(e)}`);
    }
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
