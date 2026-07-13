/**
 * ingest/ingest-before-after.ts — refresh ONLY a clinic's Before/After photos.
 *
 * Unlike ingestClinicByDomain (which re-scrapes and OVERWRITES the whole clinic —
 * locations, cover/logo/gallery, providers, services), this touches ONLY the
 * clinic's role='before_after' image rows. The clinic must already exist (keyed
 * by website domain); nothing else is created or modified.
 *
 * Flow: resolve clinic by domain → load its existing cover/logo/gallery URLs as
 * the de-dup exclude set → fetch homepage + discovered gallery/B&A pages → collect
 * + resolve candidates (ingest/before-after.ts) → delete existing SCRAPED
 * before_after rows (curated cdn_url/storage_key rows preserved) → insert. Idempotent.
 */

import { query, queryOne } from "@/lib/db";
import { fetchHtml, load, normalizeUrl } from "@/lib/scraper/utils";
import { discoverContentPages } from "@/lib/ingest/discover";
import { findClinicsByDomain, websiteDomain } from "@/lib/admin/clinic-save";
import {
  newBeforeAfterCandidates,
  scanPageForBeforeAfter,
  resolveBeforeAfter,
} from "@/lib/ingest/before-after";

export interface BeforeAfterIngestResult {
  domain: string;
  status: "saved" | "skipped" | "failed";
  clinicId?: string;
  slug?: string;
  /** candidates that survived classification + de-dup + cap */
  found: number;
  /** new before_after rows actually inserted */
  inserted: number;
  /** existing scraped before_after rows removed first */
  deleted: number;
  note?: string;
}

export async function ingestBeforeAfterByDomain(
  rawDomain: string
): Promise<BeforeAfterIngestResult> {
  const domain = websiteDomain(rawDomain);
  const base: BeforeAfterIngestResult = {
    domain,
    status: "failed",
    found: 0,
    inserted: 0,
    deleted: 0,
  };

  // 1) resolve the EXISTING clinic (never create one here)
  const clinicIds = await findClinicsByDomain(domain);
  if (clinicIds.length === 0) {
    return { ...base, status: "skipped", note: "no clinic for this domain" };
  }
  const clinicId = clinicIds[0];
  const clinicRow = await queryOne<{ name: string; slug: string; website: string | null }>(
    `SELECT name, slug, website FROM clinics WHERE id = $1`,
    [clinicId]
  );
  const slug = clinicRow?.slug;
  const businessName = clinicRow?.name ?? undefined;
  // Fetch the clinic's stored website (its true host) if present, else the arg.
  const startUrl = normalizeUrl(clinicRow?.website || rawDomain);

  // 2) existing non-B&A image URLs → exclude set. The images unique key excludes
  //    role, so a URL already used as cover/gallery/logo must NOT be re-inserted
  //    as before_after (it would be a silent ON CONFLICT no-op).
  const existingImgs = await query<{ source_url: string }>(
    `SELECT source_url FROM images
      WHERE entity_type = 'clinic' AND entity_id = $1
        AND role IN ('cover', 'gallery', 'logo')`,
    [clinicId]
  );
  const excludeUrls = new Set(existingImgs.map((r) => r.source_url));

  // 3) fetch homepage + discovered pages; scan each for B&A candidates
  const home = await fetchHtml(startUrl);
  if (!home) {
    return { ...base, clinicId, slug, status: "skipped", note: "homepage unreachable" };
  }
  const $home = load(home.html);
  const finalUrl = home.finalUrl || startUrl;

  const baCands = newBeforeAfterCandidates();
  scanPageForBeforeAfter(baCands, $home, finalUrl, { isHome: true });
  for (const u of await discoverContentPages($home, finalUrl)) {
    const r = await fetchHtml(u);
    if (!r) continue;
    scanPageForBeforeAfter(baCands, load(r.html), u);
  }

  // 4) resolve → save-ready rows (AI-classify uncertain, de-dup, cap)
  const rows = await resolveBeforeAfter(baCands, { excludeUrls, businessName, domain });

  // 5) persist ONLY before_after rows. Delete existing SCRAPED ones first
  //    (curated cdn_url/storage_key rows preserved — mirrors saveClinicBundle),
  //    then insert. Nothing else on the clinic is touched.
  const del = await query<{ id: string }>(
    `DELETE FROM images
      WHERE entity_type = 'clinic' AND entity_id = $1 AND role = 'before_after'
        AND cdn_url IS NULL AND storage_key IS NULL
      RETURNING id`,
    [clinicId]
  );

  let inserted = 0;
  let order = 0;
  for (const img of rows) {
    if (!img.source_url) continue;
    const res = await query<{ id: string }>(
      `INSERT INTO images
         (entity_type, entity_id, source_url, role, sort_order, alt_text, scraped_domain, scrape_status)
       VALUES ('clinic', $1, $2, 'before_after', $3, $4, $5, 'ok')
       ON CONFLICT (entity_type, entity_id, source_url) DO NOTHING
       RETURNING id`,
      [clinicId, img.source_url, order++, img.alt_text ?? null, domain]
    );
    inserted += res.length;
  }

  return {
    ...base,
    status: "saved",
    clinicId,
    slug,
    found: rows.length,
    inserted,
    deleted: del.length,
  };
}
