/**
 * ingest/service-normalize.ts — deterministic post-fixes for scraped service
 * names the model handles inconsistently (city-SEO suffixes, blog-title colons,
 * out-of-scope specialities, per-clinic aliases, and compound names that must
 * split into two treatments).
 *
 * Applied after the AI pass and before `saveClinicServices` resolves each name
 * to a catalog row. Extracted from the retired `ingest-services.ts` so the
 * unified treatments/concerns engine is its only consumer.
 */
import type { SaveService } from "@/lib/admin/clinic-save";

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
