/**
 * eval-scrape-accuracy.ts — run the treatment detector against a sample of real
 * medspa sites and dump what it detects, for the accuracy report.
 *
 *   bun scripts/eval-scrape-accuracy.ts > /path/out.json
 *
 * Emits JSON: [{ name, website, ok, error, detectedSlugs, rawServices }].
 * Ground truth is labeled separately; the two are merged to compute
 * precision / recall / F1 per canonical treatment.
 */

import { detectClinicServices } from "@/lib/rescrape/detect";

const SITES: Array<{ name: string; website: string }> = [
  { name: "Aesthetic Artistry", website: "https://aesthetic-artistry.com/" },
  { name: "Aesthetic Medical lounge", website: "https://aestheticmedicallounge.com/" },
  { name: "Aesthetica Medical Spa", website: "https://www.406aesthetica.com/" },
  { name: "Beauty Lab + Laser", website: "https://beautylablaser.com" },
  { name: "Beauty at the Lake", website: "https://beautyatthelake.com/" },
  { name: "Cherry Medical Spa", website: "https://cherrymedispa.com/" },
  { name: "GFaceMD", website: "https://gfacemd.com" },
  { name: "GloDerma", website: "https://gloderma.com" },
  { name: "JSJ Aesthetics co", website: "https://jsjaesthetics.com/" },
  { name: "Ruma Medical", website: "https://ruma.com" },
  { name: "San Jose Medical Spa", website: "https://www.sanjosemedspa.com/" },
  { name: "Tru Beauty By Trevor", website: "https://trubeautybytrevor.com" },
];

const CONCURRENCY = 3;

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function main() {
  const results = await mapLimit(SITES, CONCURRENCY, async (site) => {
    try {
      const det = await detectClinicServices(site.website);
      return {
        name: site.name,
        website: site.website,
        ok: det.pagesVisited > 0,
        error: null as string | null,
        pagesVisited: det.pagesVisited,
        detectedSlugs: det.matchedSlugs.sort(),
        rawServices: det.services
          .filter((s) => !s.is_noise)
          .map((s) => ({ raw_name: s.raw_name, slug: s.slug, confidence: Number(s.confidence.toFixed(2)) })),
      };
    } catch (err) {
      return {
        name: site.name,
        website: site.website,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        pagesVisited: 0,
        detectedSlugs: [] as string[],
        rawServices: [] as Array<{ raw_name: string; slug: string | null; confidence: number }>,
      };
    }
  });
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

main();
