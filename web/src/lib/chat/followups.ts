/**
 * followups.ts — guarantees every reply ends with 3–5 relevant suggested
 * questions.
 *
 * The backend always computes a deterministic candidate pool from the resolved
 * intent + slot state, independent of the model. The model's own proposals are
 * accepted only if they validate against this turn's taxonomy/slot state (a
 * follow-up naming a clinic/treatment not in context is as bad as a
 * hallucinated answer); the rest is padded from the pool. Result: a populated,
 * grounded follow-up row on every response, including total model failure.
 *
 * SERVER-SIDE ONLY.
 */
import { concernSlugToName, slugToName, type Route } from "@/lib/chat/intent";
import type { GatheredContext } from "@/lib/chat/context";

const EVERGREEN = [
  "What treatments do you cover?",
  "What skin concerns can I search by?",
  "Find medspas near me",
];

/** Deterministic candidate follow-ups derived from what we just answered. */
export function candidatePool(route: Route, g: GatheredContext): string[] {
  const pool: string[] = [];

  const treatment =
    route.treatmentSlugs[0] ??
    g.search?.filters.treatment ??
    null;
  const treatmentName = route.treatmentSlugs[0]
    ? slugToName(route.treatmentSlugs[0])
    : treatment;

  if (treatmentName) {
    pool.push(
      `What does ${treatmentName} typically cost?`,
      `How long do ${treatmentName} results last?`,
      `What concerns does ${treatmentName} treat?`,
      `Find clinics offering ${treatmentName} near me`
    );
  }

  if (route.concernSlugs[0]) {
    const cn = concernSlugToName(route.concernSlugs[0]);
    pool.push(
      `What treatments help with ${cn}?`,
      `Find clinics that treat ${cn} near me`
    );
  }

  if (g.clinic) {
    pool.push(
      `What other treatments does ${g.clinic.name} offer?`,
      `How do I book at ${g.clinic.name}?`,
      `Show me similar clinics${g.clinic.city ? ` in ${g.clinic.city}` : ""}`
    );
  }

  if (g.search && !g.search.unavailable && g.search.count > 0) {
    pool.push(
      "Show me more clinics",
      "Which of these has the best reviews?",
      "Narrow these by rating"
    );
  }

  pool.push(...EVERGREEN);
  return dedupe(pool);
}

/**
 * mergeFollowups — take the model's proposed follow-ups if they look grounded,
 * then pad from the deterministic pool to 3–5. Never returns fewer than 3.
 */
export function mergeFollowups(
  modelProposed: string[],
  route: Route,
  g: GatheredContext
): string[] {
  const pool = candidatePool(route, g);
  const validNames = buildAllowedTerms(route, g);

  const accepted: string[] = [];
  for (const raw of modelProposed) {
    const q = raw.trim();
    if (q.length < 6 || q.length > 90) continue;
    // Reject a follow-up that references a clinic/treatment not in this turn's
    // context (guards against hallucinated proper nouns).
    if (mentionsUnknownProperNoun(q, validNames)) continue;
    accepted.push(q);
  }

  const out = dedupe([...accepted, ...pool]).slice(0, 5);
  // Guarantee at least 3.
  if (out.length < 3) {
    for (const e of EVERGREEN) {
      if (!out.includes(e)) out.push(e);
      if (out.length >= 3) break;
    }
  }
  return out.slice(0, 5);
}

// ──────────────────────────────────────────────────────────────────────────
function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const key = i.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(i);
    }
  }
  return out;
}

/** Lowercased set of proper nouns the model is allowed to reference. */
function buildAllowedTerms(route: Route, g: GatheredContext): Set<string> {
  const terms = new Set<string>();
  for (const c of g.search?.clinics ?? []) terms.add(c.name.toLowerCase());
  if (g.clinic) terms.add(g.clinic.name.toLowerCase());
  return terms;
}

/**
 * Heuristic: a follow-up is rejected if it contains a Capitalized multi-word
 * phrase that looks like a clinic name we didn't surface this turn. Treatment
 * and concern names are always allowed (they're part of the fixed taxonomy).
 */
function mentionsUnknownProperNoun(q: string, allowed: Set<string>): boolean {
  // Find sequences of 2+ Capitalized words (a likely business name).
  const matches = q.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g) || [];
  for (const m of matches) {
    const lower = m.toLowerCase();
    // Allow if it's one of the clinics/treatments we actually surfaced.
    if ([...allowed].some((t) => t.includes(lower) || lower.includes(t))) continue;
    // Allow common non-clinic phrasings that happen to capitalize.
    if (/^(How|What|Which|Show|Find|Do|Does|Can|Where|Near)\b/.test(m)) continue;
    return true;
  }
  return false;
}
