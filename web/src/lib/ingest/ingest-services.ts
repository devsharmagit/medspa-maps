/**
 * ingest/ingest-services.ts — refresh ONLY a clinic's treatments/services.
 *
 * Standalone and reusable, same shape as ingest-before-after.ts / ingest-concerns.ts:
 * touches nothing but clinic_services (+ the shared services catalog) for an
 * EXISTING clinic (keyed by website domain). Locations / images / providers /
 * hours / booking / concerns are never modified. Idempotent replace: existing
 * clinic_services rows are deleted and re-asserted.
 *
 * Flow: resolve clinic → fetch homepage + discoverContentPages (same page set
 * ingestClinicByDomain uses) → gather SERVICE candidates (nav mega-menu +
 * services page) → one AI call (extractClinicServices) → deterministic
 * post-fixes (normalizeServiceOutput) → resolve + persist (saveClinicServices,
 * shared with the full-bundle save path so a raw name always resolves to the
 * same canonical row regardless of which caller touched it).
 */

import { query, queryOne } from "@/lib/db";
import { fetchHtml, load, normalizeUrl } from "@/lib/scraper/utils";
import {
  extractServices,
  extractServicesFromNav,
  extractServiceAnchors,
} from "@/lib/scraper/services";
import type { ScrapedService } from "@/lib/scraper/types";
import { discoverContentPages } from "@/lib/ingest/discover";
import { htmlToText } from "@/lib/ingest/ingest-clinic";
import { extractClinicServices, refineClinicServices } from "@/lib/ingest/ai-extract-services";
import {
  findClinicsByDomain,
  websiteDomain,
  saveClinicServices,
  type SaveService,
} from "@/lib/admin/clinic-save";

export interface ServicesIngestResult {
  domain: string;
  status: "saved" | "skipped" | "failed";
  clinicId?: string;
  slug?: string;
  /** raw services extracted (post AI + deterministic fixes, pre-resolution) */
  found: number;
  matched: number;
  auto: number;
  unmatched: number;
  modelUsed: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
  note?: string;
}

/** Deterministic post-fixes for names the model handles inconsistently. Kept
 *  identical to ingestClinicByDomain's historical behaviour (same regexes). */
export function normalizeServiceOutput(s: SaveService): SaveService[] {
  const raw = s.raw_name.replace(/[®™©]/g, "").replace(/\s+/g, " ").trim();
  const lower = raw.toLowerCase();
  const citySeo = raw.match(/^(.+?)\s+in\s+[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}$/);
  if (citySeo?.[1]) {
    const base = citySeo[1]
      .replace(/\b(?:injections?|treatments?|surgery|services?)$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (base && base.length >= 3) {
      return normalizeServiceOutput({
        ...s,
        raw_name: base,
        general_name: base,
        public_decision: "public",
        ignored: false,
      });
    }
  }
  const colonTitle = raw.match(/^([A-Za-z0-9&/+\-\s]+):\s+(how|what|why|benefits?|faqs?|frequently|everything|guide|tips)\b/i);
  if (colonTitle?.[1]) {
    const base = colonTitle[1].replace(/\s+/g, " ").trim();
    if (base && base.length >= 3) {
      return normalizeServiceOutput({
        ...s,
        raw_name: base,
        general_name: base,
        public_decision: "public",
        ignored: false,
      });
    }
  }
  if (/\b(dentistry|dental|orthodont|veneers?)\b/i.test(raw)) {
    return [{ ...s, ignored: true, public_decision: "ignored" }];
  }
  if (
    /^(body|breast|face|for men|non surgical|non-surgical|surgical|medical spa services|skin resurfacing\s*>?|skin resurfacing and skin tightening|html sitemap|request an appointment)$/i.test(raw) ||
    /^(a closer look|how|top\s+\d+|top reasons|maintain(?:ing)?|protect your skin|probiotics?\s*&|fillers?\s+faq)\b/i.test(raw) ||
    /\b(skincare routine|results last|what affects longevity|change your look|make you look younger)\b/i.test(raw) ||
    /^(add to cart|email|phone|follow on instagram|get in touch!?|scheduling|view more testimonials|what people say|start your transformation today|long-lasting results|clear)$/i.test(raw) ||
    /^grounded in science\.\s*fueled by art\.?$/i.test(raw) ||
    /\b(close\b.*\bopen|faq section|questionnaire|model inquiry|monthly specials|payment plans|vip programs?)\b/i.test(raw) ||
    /\b(results|services|specials)\s+close\s+\1\s+open\s+\1\b/i.test(raw) ||
    /^ruma\s+medical$/i.test(raw) ||
    /^ruma\s+(?!gold\b)/i.test(raw) ||
    /\bat\s+ruma\s+medical\b/i.test(raw) ||
    /\bneurowellness\b/i.test(raw) ||
    /^(reduced libido|skin.?s texture and tone)$/i.test(raw)
  ) {
    return [{ ...s, ignored: true, public_decision: "ignored" }];
  }
  if (/ruma\s+gold/i.test(raw)) {
    return [{
      ...s,
      general_name: "Microneedling",
      public_decision: "alias_only",
      ignored: false,
    }];
  }
  if (/botox\s+(?:cosmetic\s+)?treatments?$/i.test(raw)) {
    return [{ ...s, raw_name: "Botox", general_name: "Botox", public_decision: "public", ignored: false }];
  }
  if (/botox\s*(?:\/|and|&)\s*dysport/i.test(raw)) {
    return [
      { ...s, raw_name: "Botox", general_name: "Botox", public_decision: "public", ignored: false },
      { ...s, raw_name: "Dysport", general_name: "Dysport", public_decision: "public", ignored: false },
    ];
  }
  if (/^facials?$/i.test(raw)) {
    return [{ ...s, raw_name: "Facials", general_name: "Facials", public_decision: "public", ignored: false }];
  }
  if (/^babyglo$/i.test(raw)) {
    return [{ ...s, raw_name: "Facials", general_name: "Facials", public_decision: "public", ignored: false }];
  }
  if (/^glo\s+medical\s+facials?$/i.test(raw)) {
    return [{ ...s, raw_name: "Facials", general_name: "Facials", public_decision: "public", ignored: false }];
  }
  if (/^glo\s+laser$/i.test(raw)) {
    return [{ ...s, raw_name: "Laser Skin Treatments", general_name: "Laser Skin Treatments", public_decision: "public", ignored: false }];
  }
  if (/kybella.*injections?/i.test(raw)) {
    return [{ ...s, raw_name: "Kybella", general_name: "Kybella", public_decision: "public", ignored: false }];
  }
  if (/pdo\s+threads?.*\borem\b|pdo\s+thread\s+lifts?.*\borem\b/i.test(raw)) {
    return [{ ...s, raw_name: "PDO Threads", general_name: "PDO Threads", public_decision: "public", ignored: false }];
  }
  if (/full[-\s]?face\s+thread\s+lifts?.*\borem\b/i.test(raw)) {
    return [{ ...s, raw_name: "PDO Threads", general_name: "PDO Threads", public_decision: "public", ignored: false }];
  }
  if (/forever\s+young\s+bbl.*\bpayson\b/i.test(raw)) {
    return [{ ...s, raw_name: "Forever Young BBL", general_name: "BBL Forever Young", public_decision: "public", ignored: false }];
  }
  if (/laser\s+treatments?.*\bpayson\b/i.test(raw)) {
    return [{ ...s, raw_name: "Laser Skin Treatments", general_name: "Laser Skin Treatments", public_decision: "public", ignored: false }];
  }
  if (/renuva.*volume\s+loss.*ruma\s+medical/i.test(raw)) {
    return [{ ...s, raw_name: "Renuva", general_name: "Renuva", public_decision: "public", ignored: false }];
  }
  if (/women.?s\s+health.*ruma\s+medical/i.test(raw)) {
    return [{ ...s, raw_name: "Women's Health", general_name: "Women's Health", public_decision: "public", ignored: false }];
  }
  if (/sculptra\s*&\s*radiesse|sculptra\s+and\s+radiesse/i.test(raw)) {
    return [
      { ...s, raw_name: "Sculptra", general_name: "Sculptra", public_decision: "public", ignored: false },
      { ...s, raw_name: "Radiesse", general_name: "Radiesse", public_decision: "public", ignored: false },
    ];
  }
  if (/sylfirm\s*x.*rf\s*microneedling/i.test(raw)) {
    return [{ ...s, general_name: "Sylfirm X RF Microneedling" }];
  }
  if (/everesse/i.test(raw) && /skin\s+tightening/i.test(raw)) {
    return [{ ...s, general_name: "Everesse Skin Tightening" }];
  }
  if (/regenerative aesthetics.*prp\/prf/i.test(lower)) {
    return [{ ...s, general_name: "PRP/PRF" }];
  }
  if (/^laser\s+treatments?$/i.test(raw)) {
    return [{ ...s, raw_name: "Laser Skin Treatments", general_name: "Laser Skin Treatments", public_decision: "public", ignored: false }];
  }
  if (/^laser\s+skin\s+treatments?$/i.test(raw)) {
    return [{ ...s, raw_name: "Laser Skin Treatments", general_name: "Laser Skin Treatments", public_decision: "public", ignored: false }];
  }
  if (/^microneedling\s*\/\s*rf\s*microneedling$/i.test(raw)) {
    return [{ ...s, raw_name: "Microneedling", general_name: "Microneedling", public_decision: "public", ignored: false }];
  }
  if (/^sylfirm\s*x$/i.test(raw)) {
    return [{ ...s, raw_name: "Sylfirm X RF Microneedling", general_name: "Sylfirm X RF Microneedling", public_decision: "public", ignored: false }];
  }
  if (/regenerative medicine\s*\/\s*joint therapy/i.test(raw)) {
    return [{ ...s, raw_name: "Regenerative Medicine", general_name: "Regenerative Medicine", public_decision: "public", ignored: false }];
  }
  if (/eboo\s*&\s*ozone\s*therapy/i.test(raw)) {
    return [{ ...s, raw_name: "Ozone Therapy", general_name: "Ozone Therapy", public_decision: "public", ignored: false }];
  }
  return [s];
}

const SERVICES_URL_RE = /\/(services?|treatments?|menu|procedures|what-we-offer)/i;
const SVC_CAND_CAP = 80;

export async function ingestServicesByDomain(
  rawDomain: string
): Promise<ServicesIngestResult> {
  const domain = websiteDomain(rawDomain);
  const base: ServicesIngestResult = {
    domain,
    status: "failed",
    found: 0,
    matched: 0,
    auto: 0,
    unmatched: 0,
    modelUsed: "",
    usage: null,
  };

  // 1) resolve the EXISTING clinic (never create one here)
  const clinicIds = await findClinicsByDomain(domain);
  if (clinicIds.length === 0) {
    return { ...base, status: "skipped", note: "no clinic for this domain" };
  }
  const clinicId = clinicIds[0];
  const clinicRow = await queryOne<{ slug: string; website: string | null }>(
    `SELECT slug, website FROM clinics WHERE id = $1`,
    [clinicId]
  );
  const slug = clinicRow?.slug;

  // 2) fetch homepage + the SAME content pages the full ingest uses
  const startUrl = normalizeUrl(clinicRow?.website || rawDomain);
  const home = await fetchHtml(startUrl);
  if (!home) {
    return { ...base, clinicId, slug, status: "skipped", note: "homepage unreachable" };
  }
  const $home = load(home.html);
  const finalUrl = home.finalUrl || startUrl;

  const pages: Array<{ url: string; text: string }> = [
    { url: finalUrl, text: htmlToText($home) },
  ];

  // 3) gather SERVICE candidates — nav mega-menu (site-wide catalogue) + the
  //    dedicated services page's cards/headings/list items.
  const serviceCandidates: Array<{ name: string; category?: string | null; url?: string | null }> = [];
  const seenSvcCand = new Set<string>();
  const hServices: ScrapedService[] = [];
  const addSvcCands = (list: ScrapedService[]) => {
    for (const c of list) {
      const key = c.name?.trim().toLowerCase();
      if (!key || seenSvcCand.has(key)) continue;
      if (serviceCandidates.length >= SVC_CAND_CAP) break;
      seenSvcCand.add(key);
      serviceCandidates.push({ name: c.name.trim(), category: c.category ?? null, url: c.scraped_from_url ?? null });
    }
  };
  addSvcCands(extractServicesFromNav($home, finalUrl));
  addSvcCands(extractServiceAnchors($home, finalUrl));
  for (const u of await discoverContentPages($home, finalUrl)) {
    const r = await fetchHtml(u);
    if (!r) continue;
    const $p = load(r.html);
    pages.push({ url: u, text: htmlToText($p) });
    addSvcCands(extractServicesFromNav($p, u));
    addSvcCands(extractServiceAnchors($p, u));
    if (SERVICES_URL_RE.test(u)) {
      const pageSvcs = extractServices($p, u);
      hServices.push(...pageSvcs);
      addSvcCands(pageSvcs);
      addSvcCands(extractServiceAnchors($p, u));
    }
  }

  // 4) AI extraction — knownTreatments shows the live catalog (curated 15 +
  //    AI-grown) so the model reuses names before inventing new ones.
  const knownTreatments = (
    await query<{ name: string }>(`SELECT name FROM services WHERE is_active = true ORDER BY name`)
  ).map((r) => r.name);

  const out = await extractClinicServices({ domain, pages, serviceCandidates, knownTreatments });

  // 5) deterministic post-fixes + de-dup by raw_name
  const svcUrlByName = new Map(
    serviceCandidates.map((s) => [s.name.trim().toLowerCase(), s.url ?? null])
  );
  const seenSvc = new Set<string>();
  let services: SaveService[] = out.data.services
    .filter((s) => s.raw_name?.trim())
    .flatMap((s) => normalizeServiceOutput({
      raw_name: s.raw_name.trim(),
      general_name: s.general_name?.trim() || null,
      general_category: s.category?.trim() || null,
      scraped_from_url: s.source_url?.trim() || svcUrlByName.get(s.raw_name.trim().toLowerCase()) || finalUrl,
      public_decision: s.public_decision,
      ignored: s.public_decision === "ignored",
    }))
    .filter((s) => {
      const k = s.raw_name.toLowerCase();
      if (seenSvc.has(k)) return false;
      seenSvc.add(k);
      return true;
    });

  // 6) any nav/service-page candidate the AI didn't return (minus the homepage
  //    itself) still gets recorded as a public service — mirrors
  //    ingestClinicByDomain's candidate-completeness fallback.
  const serviceHomePath = (() => {
    try {
      return new URL(finalUrl).pathname.replace(/\/+$/, "") || "/";
    } catch {
      return "/";
    }
  })();
  const seenSvcUrl = new Set(
    services
      .map((s) => s.scraped_from_url)
      .filter((u): u is string => !!u)
      .map((u) => {
        try {
          return new URL(u).href.replace(/\/+$/, "");
        } catch {
          return u.replace(/\/+$/, "");
        }
      })
  );
  for (const cand of serviceCandidates) {
    if (!cand.url) continue;
    const urlKey = (() => {
      try {
        return new URL(cand.url!).href.replace(/\/+$/, "");
      } catch {
        return cand.url!.replace(/\/+$/, "");
      }
    })();
    if (seenSvcUrl.has(urlKey)) continue;
    try {
      const p = new URL(cand.url).pathname.replace(/\/+$/, "") || "/";
      if (p === serviceHomePath || p === "/") continue;
    } catch {}

    const fallback = normalizeServiceOutput({
      raw_name: cand.name.trim(),
      general_name: cand.name.trim(),
      general_category: cand.category ?? null,
      scraped_from_url: cand.url,
      public_decision: "public",
      ignored: false,
    }).filter((s) => !s.ignored);
    if (fallback.length === 0) continue;
    for (const s of fallback) {
      const k = s.raw_name.toLowerCase();
      if (seenSvc.has(k)) continue;
      seenSvc.add(k);
      services.push(s);
    }
    seenSvcUrl.add(urlKey);
  }

  services = (await refineClinicServices({
    domain,
    services: services.map((s) => ({
      raw_name: s.raw_name,
      general_name: s.general_name ?? null,
      category: s.general_category ?? null,
      source_url: s.scraped_from_url ?? null,
      public_decision: s.public_decision ?? "public",
    })),
    knownTreatments,
  })).data.services
    .flatMap((s) => normalizeServiceOutput({
      raw_name: s.raw_name,
      general_name: s.general_name,
      general_category: s.category,
      scraped_from_url: s.source_url,
      public_decision: s.public_decision,
      ignored: s.public_decision === "ignored",
    }))
    .filter((s) => !s.ignored);

  // 7) heuristic fallback — only if the AI + candidate walk produced NOTHING.
  if (services.length === 0 && hServices.length > 0) {
    const seenH = new Set<string>();
    services = hServices
      .filter((s) => s.name?.trim())
      .filter((s) => {
        const k = s.name.toLowerCase();
        if (seenH.has(k)) return false;
        seenH.add(k);
        return true;
      })
      .map((s) => ({
        raw_name: s.name.trim(),
        general_name: null,
        general_category: s.category ?? null,
        scraped_from_url: s.scraped_from_url ?? finalUrl,
      }));
  }

  // 8) resolve + persist. providerNames comes from the clinic's OWN already-
  //    saved providers (this pipeline doesn't scrape providers) so the
  //    staff-name guard in saveClinicServices still works on a standalone run.
  const providerRows = await query<{ name: string }>(
    `SELECT name FROM providers WHERE clinic_id = $1 AND is_active = true`,
    [clinicId]
  );
  const svcResult = await saveClinicServices(clinicId, services, {
    website: finalUrl,
    providerNames: providerRows.map((p) => p.name),
    overwrite: true,
  });

  return {
    ...base,
    status: "saved",
    clinicId,
    slug,
    found: services.length,
    matched: svcResult.matched,
    auto: svcResult.auto,
    unmatched: svcResult.unmatched,
    modelUsed: out.model,
    usage: out.usage,
  };
}
