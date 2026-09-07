/**
 * intent.ts — 100% deterministic intent processing for the AI assistant.
 *
 * Runs to completion BEFORE any LLM prompt is built. There is no hidden model
 * call here — only string/regex matching, taxonomy lookups, and page-type
 * inspection — so it is fast, free, reproducible, and demo-safe. Its job is to
 * (1) extract entities from the user's message and (2) pick exactly one
 * retrieval path via a fixed-priority routing table. The model never chooses a
 * "tool"; by the time the prompt is assembled the backend has already decided
 * what facts to hand it.
 *
 * SERVER-SIDE ONLY (imports taxonomy; no DB itself).
 */
import {
  CANONICAL_SERVICES,
  CANONICAL_CONCERNS,
  normalize,
} from "@/lib/taxonomy/canonical";
import { STATE_CODE_TO_NAME, toStateCode } from "@/lib/location/states";
import { resolveTypedLocation } from "@/lib/search/location-scope";
import { matchCatalogEntities, type LiveCatalog, type CatalogEntry } from "@/lib/chat/catalog";
import {
  CORE_CONCERNS,
  CORE_TREATMENTS,
  coreConcernFor,
  coreTreatmentFor,
} from "@/lib/taxonomy/core-catalog";

// ──────────────────────────────────────────────────────────────────────────
// Shared types (client sends PageContext + Slots; server maintains Slots)
// ──────────────────────────────────────────────────────────────────────────
export type PageType =
  | "home"
  | "search"
  | "treatment"
  | "concern"
  | "clinic"
  | "provider"
  | "other";

export interface PageContext {
  type: PageType;
  /** slug for treatment/concern/clinic pages (provider uses its clinic slug if known) */
  slug?: string;
}

export interface Slots {
  /** slug of the clinic currently in focus (from a clinic page or prior turn) */
  clinicInFocus?: string;
  /** last location the user gave (raw string) */
  lastLocation?: string;
  /** canonical label for that location ("Salt Lake City, UT"), for copy + reuse */
  lastLocationLabel?: string;
  /** canonical treatment slugs discussed, most-recent last, capped */
  treatmentsDiscussed: string[];
  /** the practices the assistant showed last turn — slug AND name, so a
   *  follow-up naming one ("tell me about RUMA Medical") can be resolved back
   *  to a real record instead of the model guessing. */
  lastResults?: { slug: string; name: string }[];
  /** the exact URLSearchParams string behind lastResultSlugs, so a follow-up
   *  can re-run the identical search instead of guessing new filters. */
  lastSearchParams?: string;
}

export const EMPTY_SLOTS: Slots = { treatmentsDiscussed: [] };

export interface Extraction {
  /** canonical treatment slugs, in canonical order */
  treatments: string[];
  /** canonical concern slugs, in canonical order */
  concerns: string[];
  /** raw location string (city / "City, ST" / state / ZIP) or null */
  location: string | null;
  nearMe: boolean;
  isComparison: boolean;
  isDeictic: boolean;
  /** Full catalog entries behind `treatments`/`concerns`, so display names are
   *  available for the ~951 live services that have no curated entry. */
  entities: CatalogEntry[];
  safetyKind: "emergency" | "personal" | null;
}

export type RoutePath =
  | "safety" // hardcoded refer-to-provider message, no LLM
  | "page_context" // answer from the clinic/treatment/concern page already loaded
  | "search" // call searchClinics server-side
  | "catalog" // static taxonomy lookup (incl. treatment comparisons)
  | "combined" // page clinic + a fresh scoped search
  | "smalltalk"; // nothing to fetch; persona answer / clarify

export interface Route {
  path: RoutePath;
  safetyKind?: "emergency" | "personal";
  /** treatment slugs to describe (catalog / page_context / comparison) */
  treatmentSlugs: string[];
  /** concern slugs to describe */
  concernSlugs: string[];
  /** clinic slug to load as page/slot context */
  clinicSlug?: string;
  /** search arguments when path is search/combined */
  search?: { treatment: string; location: string };
  /** the user explicitly widened the search — drop the remembered location */
  clearLocation?: boolean;
  /** the turn refers back to the clinics named last turn ("which of those…") */
  refersToPrevious?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Entity extraction
// ──────────────────────────────────────────────────────────────────────────

/** Whole-word (\b-bounded) alias match against the normalized message. */
function aliasHit(normText: string, alias: string): boolean {
  const a = normalize(alias);
  if (a.length < 3) return false; // avoid noise from 1-2 char aliases
  const re = new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  return re.test(normText);
}

/** Extract canonical treatment slugs mentioned anywhere in the message. */
export function extractTreatments(message: string): string[] {
  const norm = normalize(message);
  if (!norm) return [];
  // Map onto the core catalog and drop anything retired: every caller uses these
  // slugs to build a /search link or look up live clinic counts, so a slug that
  // is no longer active produces a dead-end answer.
  const hits: string[] = [];
  for (const svc of CANONICAL_SERVICES) {
    const candidates = [svc.name, svc.slug.replace(/-/g, " "), ...svc.aliases];
    if (!candidates.some((c) => aliasHit(norm, c))) continue;
    const core = coreTreatmentFor(svc.slug);
    if (core && !hits.includes(core)) hits.push(core);
  }
  return hits;
}

/** Extract canonical concern slugs mentioned anywhere in the message. */
export function extractConcerns(message: string): string[] {
  const norm = normalize(message);
  if (!norm) return [];
  const hits: string[] = [];
  for (const c of CANONICAL_CONCERNS) {
    const candidates = [c.name, c.slug.replace(/-/g, " "), ...c.aliases];
    if (!candidates.some((cand) => aliasHit(norm, cand))) continue;
    const core = coreConcernFor(c.slug);
    if (core && !hits.includes(core)) hits.push(core);
  }
  return hits;
}

const CITY_STATE_RE = /\b([A-Za-z][A-Za-z .'-]{1,28}),\s*([A-Z]{2})\b/;
const ZIP_RE = /\b(\d{5})\b/;
const NEAR_ME_RE = /\b(near me|nearby|around me|close to me|in my area)\b/i;
/** Words after "in/near/…" — up to six, enough for "salt lake city utah". */
const AFTER_PREPOSITION_RE = /\b(?:in|near|around|by|close to|inside)\s+(.{2,80})/i;

/**
 * A phrase that points BACK at the location already under discussion rather
 * than naming a new one: "in that city", "in this area", "in the same town".
 *
 * These have to yield NO location so the caller falls through to slot memory.
 * They used to be captured as if they were place names, and the damage was
 * silent and total: "that city" geocodes to nothing, so the scope degraded to
 * `city ILIKE '%that city%'`, matched zero clinics, and the nearest-fallback
 * then relaxed the location entirely — the user asked for chemical peels in
 * Salt Lake City and got Henderson NV, Atlanta GA and Yardley PA, under a
 * heading that said "around that city".
 *
 * Bare "there" already worked (nothing matched it), but "near there" did not.
 */
/**
 * Nouns that follow "in" without naming a place. "tell me about botox in
 * general" must not search a town called General.
 *
 * A stop-list rather than an index check, because the loose fallback exists
 * precisely for small towns the postal index does not carry — rejecting
 * everything unindexed would throw those away too.
 */
const NON_PLACE_NOUN_RE =
  /^(?:general|particular|total|fact|mind|detail|details|advance|person|addition|short|summary|theory|practice|question|comparison|the\s+(?:future|past|meantime|end|us|usa|country|states?))$/i;

const BACKREF_PLACE_RE =
  /^(?:that|this|the same|the|same)\s+(?:city|town|area|region|place|state|zip|zipcode|neighborhood|county)$|^(?:over\s+)?there$|^here$/i;

/**
 * The longest run of words after "in/near/…" that names a place our own
 * postal index recognises.
 *
 * Replaces a single lazy regex whose capture ended at a HARDCODED list of
 * follow-on words (that|which|who|offering|for|with|and|clinics|medspas|places).
 * Any other phrasing simply failed to match, and the failure was invisible:
 * "i am in salt lake city utah can you find botox providers there?" fell
 * through to the bare state-name scan, which matched "utah" and quietly
 * searched the WHOLE STATE. The results were all Utah cities, so it looked
 * right — Heber City and Roy are 40 miles from Salt Lake City in opposite
 * directions.
 *
 * Validating candidates against the index instead of guessing where the place
 * name ends means the sentence can be phrased any way at all.
 *
 * Returns at most one of:
 *   backref — points at the remembered location; the caller must defer to it
 *   place   — a validated, geocodable place string
 *   loose   — nothing validated, but a plausible short phrase worth passing on
 */
function placeAfterPreposition(message: string): {
  backref: boolean;
  place: string | null;
  loose: string | null;
} {
  const m = message.match(AFTER_PREPOSITION_RE);
  if (!m) return { backref: false, place: null, loose: null };

  const words = m[1].split(/\s+/).slice(0, 6);
  let loose: string | null = null;

  // Longest first: "salt lake city utah" must win over "salt lake city".
  for (let n = Math.min(words.length, 6); n >= 1; n--) {
    const candidate = words
      .slice(0, n)
      .join(" ")
      // Trailing punctuation from "…in that city?" or "…in Austin."
      .replace(/[^A-Za-z0-9 .'-]+$/g, "")
      .trim();
    if (candidate.length < 3) continue;
    if (BACKREF_PLACE_RE.test(candidate)) return { backref: true, place: null, loose: null };
    if (NON_PLACE_NOUN_RE.test(candidate)) continue;
    // A treatment name is never a place ("in microneedling").
    if (extractTreatments(candidate).length || extractConcerns(candidate).length) continue;
    if (resolveTypedLocation(candidate) || toStateCode(candidate) || isStateName(candidate)) {
      return { backref: false, place: candidate, loose: null };
    }
    // Remember the shortest plausible phrase as the loose fallback.
    if (n <= 3) loose = candidate;
  }
  return { backref: false, place: null, loose };
}

function isStateName(s: string): boolean {
  const n = s.trim().toLowerCase();
  return Object.values(STATE_CODE_TO_NAME).some((name) => name.toLowerCase() === n);
}

/** Deterministic location heuristic. Returns a raw location string + nearMe. */
export function extractLocation(message: string): {
  location: string | null;
  nearMe: boolean;
} {
  const nearMe = NEAR_ME_RE.test(message);

  // "City, ST" — the comma+code is a reliable anchor, but the CITY half is not:
  // the character class allows spaces, so the capture runs backwards over the
  // whole preceding clause and "anything in Austin, TX?" yielded the location
  // "anything in Austin, TX" — which geocodes to nothing and silently degrades
  // the search to a text match. So walk back from the comma and keep the
  // longest trailing run of words the index actually knows.
  const cs = message.match(CITY_STATE_RE);
  if (cs) {
    const st = cs[2];
    const cityWords = cs[1].trim().split(/\s+/);
    for (let n = Math.min(cityWords.length, 4); n >= 1; n--) {
      const candidate = `${cityWords.slice(-n).join(" ")}, ${st}`;
      if (resolveTypedLocation(candidate)) return { location: candidate, nearMe };
    }
    // Not in the index (a very small town). Pass the last few words along
    // rather than the whole clause — the site search tolerates a loose string.
    return { location: `${cityWords.slice(-3).join(" ")}, ${st}`, nearMe };
  }

  // "in/near <place>" BEFORE the bare state-name scan. "near provo utah" must
  // yield "provo utah" (a city) — scanning for state names first swallowed the
  // city and silently widened the search to all of Utah.
  const afterPrep = placeAfterPreposition(message);
  if (afterPrep.backref) return { location: null, nearMe };
  if (afterPrep.place) return { location: afterPrep.place, nearMe };

  // Full state name (longest match wins)
  const lower = ` ${normalize(message)} `;
  const stateNames = Object.values(STATE_CODE_TO_NAME)
    .map((n) => n.toLowerCase())
    .sort((a, b) => b.length - a.length);
  for (const name of stateNames) {
    if (lower.includes(` ${name} `)) return { location: name, nearMe };
  }

  // Uppercase 2-letter state code in the ORIGINAL text (avoids matching words
  // like "in"/"or"/"me" — those are lowercase in natural writing).
  const upperTokens = message.match(/\b[A-Z]{2}\b/g) || [];
  for (const tok of upperTokens) {
    if (toStateCode(tok)) return { location: tok, nearMe };
  }

  // ZIP
  const zip = message.match(ZIP_RE);
  if (zip) return { location: zip[1], nearMe };

  // Generic "in <place>" / "near <place>" fallback: the phrase named no place
  // our index knows, but the site search tolerates a loose string (it degrades
  // to a city/state/zip ILIKE), so pass the shortest sensible candidate along.
  if (afterPrep.loose) return { location: afterPrep.loose, nearMe };

  return { location: null, nearMe };
}

const COMPARISON_RE =
  /\b(vs|versus|compare|comparison|difference between|differences|which is better|better than|or)\b/i;
const DEICTIC_RE =
  /\b(this|these|that|those|here|they|them|their|it|its)\b|\bdo they\b|\bdoes it\b|\bthis (place|clinic|spot|one)\b/i;

const EMERGENCY_RE =
  /\b(emergency|911|allergic reaction|anaphyla|can'?t breathe|difficulty breathing|trouble breathing|severe (pain|swelling|reaction)|passing out|fainted|excessive bleeding|infection spreading)\b/i;
const PERSONAL_MED_RE =
  /\b(\d+\s*units|how many units|what dose|dosage|how much (botox|filler|tox|product) (do i|should i|would i|is safe|can i)|am i a candidate|right for me|safe for me|safe for my|for my (condition|health|medication|skin condition)|my medication|drug interaction|interact with|i'?m pregnant|i am pregnant|pregnan|breastfeed|nursing|i'?m allergic|i am allergic|contraindicat)\b/i;

export function detectSafety(
  message: string
): "emergency" | "personal" | null {
  if (EMERGENCY_RE.test(message)) return "emergency";
  if (PERSONAL_MED_RE.test(message)) return "personal";
  return null;
}

export function extract(message: string, catalog?: LiveCatalog): Extraction {
  // Curated aliases first — the live `services`/`concerns` tables have no alias
  // column, so this pass is the only thing that knows "tox" or "wrinkle
  // relaxers". The catalog pass then adds everything else the site offers.
  const curatedTreatments = extractTreatments(message);
  const curatedConcerns = extractConcerns(message);
  const entities: CatalogEntry[] = [];

  // Catalog hits come FIRST. They are literal matches on what the user typed,
  // whereas a curated hit may be an alias expansion — "morpheus8" is an alias
  // of the canonical "microneedling", so putting curated first made the primary
  // term "Microneedling" and threw away the word the user actually used. The
  // search still resolves through the site's alias table either way (parity is
  // the point), but the assistant can now say "Morpheus8, listed here under
  // Microneedling" instead of "I can't find Morpheus8".
  const treatments: string[] = [];
  const concerns: string[] = [];
  if (catalog) {
    const hits = matchCatalogEntities(message, catalog);
    for (const t of hits.treatments) {
      entities.push(t);
      treatments.push(t.slug);
    }
    for (const c of hits.concerns) {
      entities.push(c);
      concerns.push(c.slug);
    }
  }
  for (const t of curatedTreatments) if (!treatments.includes(t)) treatments.push(t);
  for (const c of curatedConcerns) if (!concerns.includes(c)) concerns.push(c);

  const { location, nearMe } = extractLocation(message);
  const isComparison =
    treatments.length >= 2 && COMPARISON_RE.test(message);
  return {
    treatments,
    concerns,
    location,
    nearMe,
    isComparison,
    isDeictic: DEICTIC_RE.test(message),
    safetyKind: detectSafety(message),
    entities,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Routing
// ──────────────────────────────────────────────────────────────────────────

/** Signals the user wants OTHER clinics while on a clinic/provider page. */
const OTHER_CLINICS_RE =
  /\b(other|another|similar|more|different|else|elsewhere|nearby|near me|around|compare clinics|somewhere else)\b/i;

/**
 * The turn is about the clinics we just listed, not a new search. Without this,
 * "which of those has the best reviews?" re-ran the router from scratch, got a
 * different (often empty) result set, and the assistant contradicted the answer
 * it had given one turn earlier.
 */
export const PREVIOUS_RESULTS_RE =
  /\b(those|these|them|they|the (first|second|third|last|top) one|any of (them|those)|which one|which of|that clinic|that one|the ones you)\b/i;

/**
 * Which of the practices we just showed is the user asking about?
 *
 * Only the ones actually surfaced this session are candidates, so this can
 * never conjure a practice — it just maps "tell me about RUMA Medical" back to
 * the record behind the card. Without it there was NO way to bring a practice
 * into focus from the conversation: `clinicSlug` was only ever set from the URL
 * of a /practices/[slug] page, so every detail question on the homepage was
 * answered with "I don't have that information".
 */
export function resolveMentionedClinic(message: string, slots: Slots): string | null {
  const norm = ` ${normalize(message)} `;
  let best: { slug: string; len: number } | null = null;
  for (const c of slots.lastResults ?? []) {
    const name = normalize(c.name);
    // Very short names would match incidental words; require a real handle.
    if (name.length < 4) continue;
    if (!norm.includes(` ${name} `) && !norm.includes(` ${name},`)) {
      // Also accept the distinctive leading word ("RUMA" for "RUMA Medical"),
      // which is how people usually refer to a practice in conversation.
      const head = name.split(" ")[0];
      if (head.length < 4 || !norm.includes(` ${head} `)) continue;
    }
    // Longest match wins, so "Nouvelle Aesthetics" beats a shared first word.
    if (!best || name.length > best.len) best = { slug: c.slug, len: name.length };
  }
  return best?.slug ?? null;
}

/** The user asking to drop the geographic filter entirely. */
export const CLEAR_LOCATION_RE =
  /\b(anywhere|any city|any state|nationwide|all over|across the (country|us)|everywhere|no location|any location|whole country)\b/i;

/**
 * Resolve the effective location from the message + memory.
 *
 * Carrying `lastLocation` forward is what makes "what about fillers there?"
 * work. It used to be carried UNCONDITIONALLY and could never be cleared, so
 * one mention of Austin pinned every later search to Austin for the rest of the
 * session with no way out. An explicit widen ("anywhere", "nationwide") now
 * drops it.
 */
function resolveLocation(ex: Extraction, slots: Slots, clearLocation: boolean): string {
  if (clearLocation) return "";
  if (ex.location) return ex.location;
  return slots.lastLocation ?? "";
}

/**
 * route(message, page, slots) — choose exactly one retrieval path, in fixed
 * priority order. Deterministic; no model involvement.
 */
export function route(
  message: string,
  page: PageContext,
  slots: Slots,
  catalog?: LiveCatalog
): { route: Route; extraction: Extraction } {
  const ex = extract(message, catalog);
  const clearLocation = CLEAR_LOCATION_RE.test(message);
  const refersToPrevious =
    PREVIOUS_RESULTS_RE.test(message) && (slots.lastResults?.length ?? 0) > 0;
  const onClinicPage = page.type === "clinic" || page.type === "provider";
  // If we just showed clinics somewhere and the user now names another
  // treatment ("what about fillers there?"), they still want clinics. Without
  // this the turn fell to the catalog path, no search ran, and the model —
  // handed no SEARCH_RESULTS — invented clinic names.
  const continuingClinicSearch =
    !clearLocation &&
    Boolean(slots.lastLocation) &&
    (slots.lastResults?.length ?? 0) > 0 &&
    (ex.treatments.length > 0 || ex.concerns.length > 0);
  const wantsClinics =
    ex.location !== null ||
    ex.nearMe ||
    continuingClinicSearch ||
    /\b(clinic|clinics|medspa|medspas|med spa|practice|practices|provider|providers|place|places|find|show me|near|who offers|who does|where can)\b/i.test(
      message
    );

  // Priority 0 — medical-safety short-circuit (no LLM).
  if (ex.safetyKind) {
    return {
      extraction: ex,
      route: {
        path: "safety",
        safetyKind: ex.safetyKind,
        treatmentSlugs: ex.treatments,
        concernSlugs: ex.concerns,
      },
    };
  }

  // Priority 0.4 — the user is asking about ONE practice we already showed,
  // either by name ("tell me about RUMA Medical") or by pronoun once one is in
  // focus ("what are their hours?"). Load that record so the answer comes from
  // the database rather than "I don't have that information".
  const mentioned = resolveMentionedClinic(message, slots);
  const focusSlug =
    mentioned ??
    (slots.clinicInFocus && (ex.isDeictic || !wantsClinics)
      ? slots.clinicInFocus
      : null);
  if (focusSlug && !onClinicPage) {
    // "other practices like this one" is still a search, not a detail question.
    const wantsOthers = OTHER_CLINICS_RE.test(message);
    if (!wantsOthers) {
      return {
        extraction: ex,
        route: {
          path: "page_context",
          treatmentSlugs: ex.treatments,
          concernSlugs: ex.concerns,
          clinicSlug: focusSlug,
        },
      };
    }
  }

  // Priority 0.5 — the turn is purely about the practices we just listed
  // ("which of those has the best reviews?"). It names no treatment and no
  // place, so every other rule falls through to smalltalk and the assistant
  // answers "I don't have that" about clinics it showed one turn ago. Replay
  // the previous query instead.
  if (refersToPrevious) {
    return {
      extraction: ex,
      route: {
        path: "search",
        treatmentSlugs: ex.treatments,
        concernSlugs: ex.concerns,
        search: { treatment: "", location: slots.lastLocation ?? "" },
        clearLocation: false,
        refersToPrevious: true,
      },
    };
  }

  // Priority 1–2 & 6 — clinic/provider page behavior.
  if (onClinicPage && page.slug) {
    // "show me other/nearby clinics" → combined (page clinic + fresh search)
    if (wantsClinics && OTHER_CLINICS_RE.test(message)) {
      return {
        extraction: ex,
        route: {
          path: "combined",
          clinicSlug: page.slug,
          treatmentSlugs: ex.treatments,
          concernSlugs: ex.concerns,
          // location filled from the clinic's own city/state by the route handler
          search: { treatment: ex.treatments[0]
            ? slugToName(ex.treatments[0])
            : "", location: "" },
        },
      };
    }
    // deictic reference OR a same-clinic question → answer from page context
    if (ex.isDeictic || !wantsClinics) {
      return {
        extraction: ex,
        route: {
          path: "page_context",
          clinicSlug: page.slug,
          treatmentSlugs: ex.treatments,
          concernSlugs: ex.concerns,
        },
      };
    }
    // otherwise fall through to normal search below
  }

  // Priority 3 — treatment comparison (no location).
  if (ex.isComparison && !ex.location && !ex.nearMe) {
    return {
      extraction: ex,
      route: {
        path: "catalog",
        treatmentSlugs: ex.treatments.slice(0, 2),
        concernSlugs: [],
      },
    };
  }

  // On a treatment/concern page, a generic/deictic question → describe that entity.
  if (
    (page.type === "treatment" || page.type === "concern") &&
    page.slug &&
    (!wantsClinics || ex.isDeictic) &&
    !ex.location &&
    !ex.nearMe
  ) {
    return {
      extraction: ex,
      route: {
        path: "catalog",
        treatmentSlugs:
          page.type === "treatment" ? [page.slug, ...ex.treatments] : ex.treatments,
        concernSlugs:
          page.type === "concern" ? [page.slug, ...ex.concerns] : ex.concerns,
      },
    };
  }

  // Priority 4 — entities mentioned but NO clinic-finding intent and no
  // location → describe them from the catalog (treatment/concern info). This
  // catches "how much does CoolSculpting cost?" and "what helps with acne
  // scars?" — informational questions that must NOT trigger a clinic search.
  const hasEntity = ex.treatments.length > 0 || ex.concerns.length > 0;
  if (hasEntity && !wantsClinics && !ex.location && !ex.nearMe) {
    return {
      extraction: ex,
      route: {
        path: "catalog",
        treatmentSlugs: ex.treatments.slice(0, 2),
        concernSlugs: ex.concerns.slice(0, 2),
      },
    };
  }

  // Priority 5 — treatment and/or location (clinic-finding) → search.
  if (wantsClinics || ex.treatments.length > 0 || ex.concerns.length > 0) {
    // Pass the concern through AS a concern. It used to be rewritten into the
    // concern's first treatment, which threw away the `condition=` filter and
    // silently narrowed "clinics for acne scars" to one arbitrary treatment.
    // resolveSearchQuery resolves concern names too, so the adapter builds
    // `?condition=<slug>` from this.
    // Pass the SLUG, not the display name. `ex.treatments`/`ex.concerns` are
    // already catalog slugs, and resolveSearchQuery is an exact slug lookup as
    // of 2026-09-07 — handing it a name would resolve to nothing and the
    // adapter would (correctly) refuse to search at all.
    const treatmentArg = ex.treatments[0] ?? ex.concerns[0] ?? "";
    return {
      extraction: ex,
      route: {
        path: "search",
        treatmentSlugs: ex.treatments,
        concernSlugs: ex.concerns,
        search: { treatment: treatmentArg, location: resolveLocation(ex, slots, clearLocation) },
        clearLocation,
        refersToPrevious,
      },
    };
  }

  // Priority 7 — nothing actionable.
  return {
    extraction: ex,
    route: {
      path: "smalltalk",
      treatmentSlugs: [],
      concernSlugs: [],
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Small helpers
// ──────────────────────────────────────────────────────────────────────────
/**
 * Slug → display name, CORE catalog first.
 *
 * These feed user-visible strings: the follow-up chips and the "Finding …
 * practices near X" status line. They used to read CANONICAL_SERVICES only,
 * which is the static Phase-0 list of 15 — post-reduction just 10 of the 19
 * core treatment slugs and 2 of the 14 concern slugs appear in it, so the
 * `?? slug` fallback took over and chips read "What does a rf-microneedling
 * consultation involve?". CANONICAL_* is kept as a second lookup so a retired
 * slug arriving from an old session slot still gets a readable name.
 */
export function slugToName(slug: string): string {
  return (
    CORE_TREATMENTS.find((s) => s.slug === slug)?.name ??
    CANONICAL_SERVICES.find((s) => s.slug === slug)?.name ??
    slug
  );
}

export function concernSlugToName(slug: string): string {
  return (
    CORE_CONCERNS.find((c) => c.slug === slug)?.name ??
    CANONICAL_CONCERNS.find((c) => c.slug === slug)?.name ??
    slug
  );
}

/** Update slot memory from a turn's extraction (deterministic, never model-set). */
export function updateSlots(
  prev: Slots,
  ex: Extraction,
  page: PageContext,
  /** the raw user message, for resolving a practice named in conversation */
  message: string,
  effectiveLocation: string,
  /** Set when the user explicitly widened the search ("anywhere", "any city"). */
  clearLocation = false
): Slots {
  // Re-derive the widen signal from the message rather than trusting the flag
  // alone. The caller reads it off the route, but only the SEARCH branch sets
  // it — so "what about nationwide?" on its own (no treatment named, so it
  // routes to smalltalk) left the old location in memory and the next search
  // silently went back to it. Deriving it here means no future route can forget.
  const widened = clearLocation || CLEAR_LOCATION_RE.test(message);
  const treatmentsDiscussed = [...prev.treatmentsDiscussed];
  for (const t of ex.treatments) {
    const idx = treatmentsDiscussed.indexOf(t);
    if (idx !== -1) treatmentsDiscussed.splice(idx, 1);
    treatmentsDiscussed.push(t);
  }
  while (treatmentsDiscussed.length > 5) treatmentsDiscussed.shift();

  let clinicInFocus = prev.clinicInFocus;
  if ((page.type === "clinic" || page.type === "provider") && page.slug) {
    clinicInFocus = page.slug;
  }
  // A practice named in conversation stays in focus for follow-ups.
  const mentioned = resolveMentionedClinic(message, prev);
  if (mentioned) clinicInFocus = mentioned;

  return {
    ...prev,
    clinicInFocus,
    lastLocation: widened ? undefined : effectiveLocation || prev.lastLocation,
    lastLocationLabel: widened ? undefined : prev.lastLocationLabel,
    treatmentsDiscussed,
  };
}
