/**
 * Scrapes clinic websites to find cover images.
 * Two levels of parallelism:
 *   1. Clinics processed in batches of BATCH_SIZE simultaneously.
 *   2. For each clinic, homepage + /about + /team fetched in parallel
 *      — first page that yields a keyword-matching image wins.
 *
 * Found image URLs are sent to Next.js to store — this server never touches the DB.
 */

import * as cheerio from "cheerio";
import { getClinicsMissingImages, saveClinicImage } from "../api-client";
import { runInBatches } from "../batch";

const BATCH_SIZE = 5;

const LOCATION_KEYWORDS = [
  "location", "clinic", "spa", "medspa",
  "exterior", "building", "office", "facility",
];

export async function runImageFinder(): Promise<void> {
  console.log("── Image Finder started ──────────────────────────────────────");

  const clinics = await getClinicsMissingImages();
  console.log(`  ${clinics.length} clinics need cover images`);
  console.log(`  running in batches of ${BATCH_SIZE}\n`);

  const results = await runInBatches(clinics, BATCH_SIZE, findAndSaveImage);

  const ok = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;

  console.log(`\n── Image Finder complete — ${ok} ok, ${failed} failed ──────────\n`);
}

async function findAndSaveImage(clinic: {
  id: string;
  name: string;
  website: string;
  business_name: string;
}): Promise<void> {
  const baseUrl = normalizeBase(clinic.website);
  if (!baseUrl) return;

  const domain = new URL(baseUrl).hostname;
  const keywords = [
    clinic.name.toLowerCase(),
    clinic.business_name.toLowerCase(),
    ...LOCATION_KEYWORDS,
  ];

  // Fetch all candidate pages in parallel — pick the first that has a match
  const pagesToTry = [baseUrl, `${baseUrl}/about`, `${baseUrl}/team`];

  const pageResults = await Promise.allSettled(
    pagesToTry.map((url) => scrapePageForImage(url, keywords))
  );

  for (const settled of pageResults) {
    if (settled.status === "fulfilled" && settled.value) {
      const absolute = toAbsolute(settled.value.src, baseUrl);
      if (!absolute) continue;

      await saveClinicImage(clinic.id, {
        source_url: absolute,
        scraped_domain: domain,
        alt_text: settled.value.alt || undefined,
        found: true,
      });
      console.log(`  ✓ ${clinic.name} → ${absolute}`);
      return;
    }
  }

  // Nothing found on any page — mark failed so we skip next run
  await saveClinicImage(clinic.id, {
    source_url: clinic.website,
    scraped_domain: domain,
    found: false,
  });
  console.log(`  ✗ ${clinic.name} — no image found`);
}

async function scrapePageForImage(
  url: string,
  keywords: string[]
): Promise<{ src: string; alt: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "MedSpaMaps-Bot/1.0" },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);
    let best: { src: string; alt: string } | null = null;

    $("img").each((_, el) => {
      if (best) return;
      const src = $(el).attr("src") ?? "";
      const alt = ($(el).attr("alt") ?? "").toLowerCase();

      if (!src || src.startsWith("data:")) return;

      const w = parseInt($(el).attr("width") ?? "0");
      const h = parseInt($(el).attr("height") ?? "0");
      if ((w > 0 && w < 100) || (h > 0 && h < 100)) return;

      if (keywords.some((kw) => alt.includes(kw))) {
        best = { src, alt: $(el).attr("alt") ?? "" };
      }
    });

    return best;
  } catch {
    return null;
  }
}

function normalizeBase(website: string): string | null {
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function toAbsolute(src: string, base: string): string | null {
  try {
    if (src.startsWith("http")) return src;
    if (src.startsWith("//")) return `https:${src}`;
    if (src.startsWith("/")) return `${base}${src}`;
    return `${base}/${src}`;
  } catch {
    return null;
  }
}
