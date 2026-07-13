/**
 * ingest/concern-validate.ts — machine-verify AI-extracted concern claims.
 *
 * The AI prompt promises verification; this module delivers it. An extracted
 * concern survives ONLY if:
 *   1. its source_url is one of the pages we actually supplied;
 *   2. its evidence_quote genuinely appears in that page's text (normalized
 *      substring, with a token-shingle Dice ≥ 0.9 fuzzy fallback for minor
 *      whitespace/entity drift);
 *   3. the quote actually names the concern (raw_phrase in quote, fuzzy-tolerant).
 * Everything else is rejected WITH a reason (surfaced in the ingest report).
 * Survivors are grouped per general_name (no per-clinic cap — every concern the
 * clinic's site evidences is kept); paired treatments are resolved against the
 * clinic's own services.
 */

import { fuzzyScore, normalize } from "@/lib/taxonomy/canonical";
import type { ExtractedConcern } from "@/lib/ingest/ai-extract-concerns";

/** Normalize free text for containment checks: lowercase, straighten curly
 *  quotes/dashes, drop punctuation, collapse whitespace — tolerant of the small
 *  entity/whitespace drift between page text and a copied quote. */
export function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9\s&']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-shingle (bigram) Dice between a quote and the best-aligned window of
 *  the page — fuzzy fallback when exact normalized containment fails. */
function windowDice(quote: string, page: string): number {
  const qTokens = quote.split(" ").filter(Boolean);
  const pTokens = page.split(" ").filter(Boolean);
  if (qTokens.length === 0 || pTokens.length < qTokens.length) return 0;
  const shingles = (toks: string[]): Set<string> => {
    const out = new Set<string>();
    for (let i = 0; i < toks.length - 1; i++) out.add(toks[i] + " " + toks[i + 1]);
    if (toks.length === 1) out.add(toks[0]);
    return out;
  };
  const q = shingles(qTokens);
  if (q.size === 0) return 0;
  // Slide a window of the quote's length across the page; early-exit on strong hit.
  const win = qTokens.length;
  let best = 0;
  for (let i = 0; i + win <= pTokens.length; i++) {
    const p = shingles(pTokens.slice(i, i + win));
    let inter = 0;
    for (const s of q) if (p.has(s)) inter++;
    const dice = (2 * inter) / (q.size + p.size);
    if (dice > best) best = dice;
    if (best >= 0.98) break;
  }
  return best;
}

export interface ConcernRejection {
  item: ExtractedConcern;
  reason: string;
}

export interface ValidatedEvidence {
  raw_phrase: string;
  evidence_quote: string;
  source_url: string;
  paired_treatments: string[];
  paired_service_ids: string[];
}

export interface ValidatedConcern {
  general_name: string;
  evidences: ValidatedEvidence[];
}

export interface ClinicServiceRef {
  service_id: string | null;
  raw_name: string;
  canonical_name: string | null;
  scraped_from_url?: string | null;
}

export interface ValidateResult {
  accepted: ValidatedConcern[];
  rejected: ConcernRejection[];
}

// Vague marketing categories are not patient conditions — a chip saying
// "Persistent Skin Challenges" helps nobody search.
const VAGUE_NAME_RE =
  /\b(challenge|journey|goal|wellness|well-being|self[\s-]?care|confidence|imperfection|maintenance|rejuvenation|refresh|glow|radiance|beauty|appearance|skin health)\b/i;

// Generic symptoms / general-medicine territory — mentioned by IV-therapy and
// wellness marketing with perfectly verifiable quotes, but not aesthetic
// conditions a medspa directory should list ("Pain", "Illness", "Hearing
// Loss", "High Cholesterol"…). Without the per-clinic cap these flooded in, so
// the quality gate moved here: reject by NAME, keep specific concerns
// (Hormonal Imbalance, Fatigue, Erectile Dysfunction, Enlarged Pores…).
const GENERIC_SYMPTOM_RE =
  /\b(pain|discomfort|illness|injur(?:y|ies)|stress|sleep|insomnia|mood|anxiety|depression|brain\s*fog|cravings?|lethargy|inflammation|oxidative|cholesterol|blood\s+pressure|hearing|tremors?|migraines?|headaches?|problems?|issues?|concerns?|changes?|disorders?|performance|detox)\b/i;

// First-person testimonial voice — review quotes are patients talking, not the
// clinic asserting what it treats. (Clinic voice is "we", which stays allowed.)
const TESTIMONIAL_RE =
  /\bi\s*(did|had|got|went|was|am|have|tried|love|loved|recommend|couldn'?t|wasn'?t|'m|'ve)\b/i;

// Side effects / contraindications are not treated concerns. Example: hormone
// therapy pages may mention "increased hair growth" as a possible side effect;
// that must never become an "Unwanted Hair" concern for the clinic.
const SIDE_EFFECT_RE =
  /\b(side effects?|adverse effects?|risks?|complications?|contraindications?|warning|warnings|may cause|can cause|could cause|possible effects?|common effects?|after treatment|post-treatment|temporary redness|swelling|bruising|tenderness|irritation|increased hair growth)\b/i;

const TREATED_INTENT_RE =
  /\b(treats?|treated|addresses|address|targets?|target|helps? (?:with|address|treat|reduce|improve)|reduces?|improves?|corrects?|relieves?|eases?|for patients with|designed for|ideal for)\b/i;
const DEFINITION_ONLY_RE =
  /\b(is|are|occurs?|happens?|refers to|defined as|is the|are the)\b/i;

/** Resolve a page-stated treatment name against the clinic's own services. */
function resolvePairedService(
  name: string,
  services: ClinicServiceRef[]
): string | null {
  const n = normalize(name);
  if (!n) return null;
  let bestId: string | null = null;
  let bestScore = 0;
  for (const s of services) {
    if (!s.service_id) continue;
    for (const cand of [s.raw_name, s.canonical_name]) {
      if (!cand) continue;
      const c = normalize(cand);
      if (!c) continue;
      const score = c === n || c.includes(n) || n.includes(c) ? 1 : fuzzyScore(c, n);
      if (score > bestScore) {
        bestScore = score;
        bestId = s.service_id;
      }
    }
  }
  return bestScore >= 0.72 ? bestId : null;
}

function serviceFromSourceUrl(
  sourceUrl: string,
  services: ClinicServiceRef[]
): { id: string; name: string } | null {
  const key = (u: string) => u.trim().replace(/\/+$/, "").toLowerCase();
  const src = key(sourceUrl);
  if (!src) return null;
  const hit = services.find(
    (s) => s.service_id && s.scraped_from_url && key(s.scraped_from_url) === src
  );
  return hit?.service_id
    ? { id: hit.service_id, name: hit.canonical_name || hit.raw_name }
    : null;
}

function phraseVariants(rawPhrase: string): string[] {
  const variants = new Set<string>();
  const add = (v: string) => {
    const n = normText(v);
    if (n && n.length >= 3) variants.add(n);
  };
  add(rawPhrase);
  add(rawPhrase.replace(/\([^)]*\)/g, " "));
  for (const m of rawPhrase.matchAll(/\(([^)]{2,})\)/g)) add(m[1]);
  for (const part of rawPhrase.split(/\s*(?:\/|&|\band\b|\bor\b)\s*/i)) add(part);
  return [...variants];
}

function quoteMentionsPhrase(rawPhrase: string, nQuote: string): boolean {
  const variants = phraseVariants(rawPhrase);
  for (const v of variants) {
    if (nQuote.includes(v) || fuzzyScore(v, nQuote) >= 0.6) return true;
  }
  return false;
}

export function validateConcerns(
  items: ExtractedConcern[],
  pages: Array<{ url: string; text: string }>,
  clinicServices: ClinicServiceRef[],
  /** live concern-catalog names — known concerns sort first in the output */
  knownConcernNames: string[] = []
): ValidateResult {
  // Normalize page urls the same way source_url will be compared (trim trailing /).
  const urlKey = (u: string): string => u.trim().replace(/\/+$/, "").toLowerCase();
  const pageByUrl = new Map<string, string>(
    pages.map((p) => [urlKey(p.url), normText(p.text)])
  );

  const rejected: ConcernRejection[] = [];
  const byGeneral = new Map<string, ValidatedConcern>();
  const seenEvidence = new Set<string>();

  for (const item of items) {
    const quote = (item.evidence_quote ?? "").trim();
    const rawPhrase = (item.raw_phrase ?? "").trim();
    const generalName = (rawPhrase || item.general_name || "").replace(/\s+/g, " ").trim();
    if (!quote || !rawPhrase || !generalName) {
      rejected.push({ item, reason: "empty raw_phrase/general_name/evidence_quote" });
      continue;
    }
    if (generalName.length < 3 || normalize(generalName).length < 3) {
      rejected.push({ item, reason: "general_name too short/empty after normalize" });
      continue;
    }
    if (VAGUE_NAME_RE.test(generalName)) {
      rejected.push({ item, reason: `vague marketing category, not a condition: "${generalName}"` });
      continue;
    }
    if (GENERIC_SYMPTOM_RE.test(generalName)) {
      rejected.push({ item, reason: `generic symptom / general-medicine term, not a medspa concern: "${generalName}"` });
      continue;
    }
    if (TESTIMONIAL_RE.test(quote)) {
      rejected.push({ item, reason: "evidence looks like a patient testimonial, not clinic copy" });
      continue;
    }
    if (SIDE_EFFECT_RE.test(quote)) {
      rejected.push({ item, reason: "evidence describes a side effect/warning, not a treated concern" });
      continue;
    }
    if (DEFINITION_ONLY_RE.test(quote) && !TREATED_INTENT_RE.test(quote)) {
      rejected.push({ item, reason: "evidence defines/describes the concern but does not say the clinic treats it" });
      continue;
    }

    // 1. source_url must be a supplied page
    const pageText = pageByUrl.get(urlKey(item.source_url ?? ""));
    if (!pageText) {
      rejected.push({ item, reason: `source_url not among supplied pages: ${item.source_url}` });
      continue;
    }

    // 2. quote must appear on that page (normalized substring, fuzzy fallback)
    const nQuote = normText(quote);
    if (!nQuote || nQuote.split(" ").length < 2) {
      rejected.push({ item, reason: "evidence_quote too short to verify" });
      continue;
    }
    if (!pageText.includes(nQuote) && windowDice(nQuote, pageText) < 0.9) {
      rejected.push({ item, reason: "evidence_quote not found on the page (invented/paraphrased)" });
      continue;
    }

    // 3. the quote must actually name the concern
    const nPhrase = normText(rawPhrase);
    if (!quoteMentionsPhrase(rawPhrase, nQuote)) {
      rejected.push({ item, reason: "quote does not mention the claimed concern phrase" });
      continue;
    }

    // 4. dedupe identical evidence
    const genKey = normalize(generalName);
    const evKey = `${genKey}|${urlKey(item.source_url)}|${nPhrase}`;
    if (seenEvidence.has(evKey)) {
      rejected.push({ item, reason: "duplicate evidence (same concern/page/phrase)" });
      continue;
    }
    seenEvidence.add(evKey);

    // 5. resolve paired treatments against the clinic's services
    const pairedNames = [...new Set((item.paired_treatments ?? []).map((t) => t.trim()).filter(Boolean))];
    const pairedIds = [
      ...new Set(
        pairedNames
          .map((t) => resolvePairedService(t, clinicServices))
          .filter((id): id is string => !!id)
      ),
    ];
    const sourceService = serviceFromSourceUrl(item.source_url, clinicServices);
    if (sourceService && !pairedIds.includes(sourceService.id)) {
      pairedIds.push(sourceService.id);
      if (!pairedNames.includes(sourceService.name)) pairedNames.push(sourceService.name);
    }
    if (pairedIds.length === 0) {
      rejected.push({ item, reason: "concern is not tied to an approved public clinic service" });
      continue;
    }

    const entry = byGeneral.get(genKey) ?? { general_name: generalName, evidences: [] };
    entry.evidences.push({
      raw_phrase: rawPhrase,
      evidence_quote: quote.slice(0, 300),
      source_url: item.source_url.trim(),
      paired_treatments: pairedNames,
      paired_service_ids: pairedIds,
    });
    byGeneral.set(genKey, entry);
  }

  // No per-clinic cap — keep EVERY validated concern. Ordering is cosmetic
  // (stable output): known-catalog concerns first, then most-evidenced.
  const known = new Set(knownConcernNames.map((n) => normalize(n)));
  const isKnown = (c: ValidatedConcern) => (known.has(normalize(c.general_name)) ? 1 : 0);
  const accepted = [...byGeneral.values()].sort(
    (a, b) => isKnown(b) - isKnown(a) || b.evidences.length - a.evidences.length
  );

  return { accepted, rejected };
}
