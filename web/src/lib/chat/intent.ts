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
import { STATE_ABBR_TO_NAME, NAME_TO_ABBR } from "@/lib/chat/data";

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
  /** canonical treatment slugs discussed, most-recent last, capped */
  treatmentsDiscussed: string[];
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
  const hits: string[] = [];
  for (const svc of CANONICAL_SERVICES) {
    const candidates = [svc.name, svc.slug.replace(/-/g, " "), ...svc.aliases];
    if (candidates.some((c) => aliasHit(norm, c))) hits.push(svc.slug);
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
    if (candidates.some((cand) => aliasHit(norm, cand))) hits.push(c.slug);
  }
  return hits;
}

const CITY_STATE_RE = /\b([A-Za-z][A-Za-z .'-]{1,28}),\s*([A-Z]{2})\b/;
const ZIP_RE = /\b(\d{5})\b/;
const NEAR_ME_RE = /\b(near me|nearby|around me|close to me|in my area)\b/i;
const IN_PLACE_RE =
  /\b(?:in|near|around|by|close to)\s+([A-Za-z][A-Za-z .'-]{2,30}?)(?=[,.?!]|$|\s+(?:that|which|who|offering|for|with|and|clinics?|medspas?|places?))/i;

/** Deterministic location heuristic. Returns a raw location string + nearMe. */
export function extractLocation(message: string): {
  location: string | null;
  nearMe: boolean;
} {
  const nearMe = NEAR_ME_RE.test(message);

  // "City, ST"
  const cs = message.match(CITY_STATE_RE);
  if (cs) return { location: `${cs[1].trim()}, ${cs[2]}`, nearMe };

  // Full state name (longest match wins)
  const lower = ` ${normalize(message)} `;
  const stateNames = Object.keys(NAME_TO_ABBR).sort(
    (a, b) => b.length - a.length
  );
  for (const name of stateNames) {
    if (lower.includes(` ${name} `)) return { location: name, nearMe };
  }

  // Uppercase 2-letter state code in the ORIGINAL text (avoids matching words
  // like "in"/"or"/"me" — those are lowercase in natural writing).
  const upperTokens = message.match(/\b[A-Z]{2}\b/g) || [];
  for (const tok of upperTokens) {
    if (STATE_ABBR_TO_NAME[tok]) return { location: tok, nearMe };
  }

  // ZIP
  const zip = message.match(ZIP_RE);
  if (zip) return { location: zip[1], nearMe };

  // Generic "in <place>" / "near <place>" fallback (loose; search tolerates it)
  const inPlace = message.match(IN_PLACE_RE);
  if (inPlace) {
    const candidate = inPlace[1].trim();
    // Reject if the captured phrase is actually a treatment/concern word.
    if (
      extractTreatments(candidate).length === 0 &&
      extractConcerns(candidate).length === 0
    ) {
      return { location: candidate, nearMe };
    }
  }

  return { location: null, nearMe };
}

const COMPARISON_RE =
  /\b(vs|versus|compare|comparison|difference between|differences|which is better|better than|or)\b/i;
const DEICTIC_RE =
  /\b(this|these|that|those|here|they|them|their|it|its)\b|\bdo they\b|\bdoes it\b|\bthis (place|clinic|spot|one)\b/i;

const EMERGENCY_RE =
  /\b(emergency|911|allergic reaction|anaphyla|can'?t breathe|difficulty breathing|trouble breathing|severe (pain|swelling|reaction)|passing out|fainted|excessive bleeding|infection spreading)\b/i;
const PERSONAL_MED_RE =
  /\b(\d+\s*units|how many units|what dose|dosage|how much (botox|filler|tox|product)|am i a candidate|right for me|safe for me|safe for my|for my (condition|health|medication|skin condition)|my medication|drug interaction|interact with|i'?m pregnant|i am pregnant|pregnan|breastfeed|nursing|i'?m allergic|i am allergic|contraindicat)\b/i;

export function detectSafety(
  message: string
): "emergency" | "personal" | null {
  if (EMERGENCY_RE.test(message)) return "emergency";
  if (PERSONAL_MED_RE.test(message)) return "personal";
  return null;
}

export function extract(message: string): Extraction {
  const treatments = extractTreatments(message);
  const concerns = extractConcerns(message);
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
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Routing
// ──────────────────────────────────────────────────────────────────────────

/** Signals the user wants OTHER clinics while on a clinic/provider page. */
const OTHER_CLINICS_RE =
  /\b(other|another|similar|more|different|else|elsewhere|nearby|near me|around|compare clinics|somewhere else)\b/i;

/** Resolve the effective location string from the message + memory. */
function resolveLocation(ex: Extraction, slots: Slots): string {
  if (ex.location) return ex.location;
  if (ex.nearMe && slots.lastLocation) return slots.lastLocation;
  if (slots.lastLocation) return slots.lastLocation;
  return "";
}

/**
 * route(message, page, slots) — choose exactly one retrieval path, in fixed
 * priority order. Deterministic; no model involvement.
 */
export function route(
  message: string,
  page: PageContext,
  slots: Slots
): { route: Route; extraction: Extraction } {
  const ex = extract(message);
  const onClinicPage = page.type === "clinic" || page.type === "provider";
  const wantsClinics =
    ex.location !== null ||
    ex.nearMe ||
    /\b(clinic|clinics|medspa|medspas|med spa|provider|providers|place|places|find|show me|near|who offers|where can)\b/i.test(
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
    const treatmentArg = ex.treatments[0]
      ? slugToName(ex.treatments[0])
      : ex.concerns[0]
        ? firstTreatmentForConcern(ex.concerns[0])
        : "";
    return {
      extraction: ex,
      route: {
        path: "search",
        treatmentSlugs: ex.treatments,
        concernSlugs: ex.concerns,
        search: { treatment: treatmentArg, location: resolveLocation(ex, slots) },
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
export function slugToName(slug: string): string {
  return CANONICAL_SERVICES.find((s) => s.slug === slug)?.name ?? slug;
}

export function concernSlugToName(slug: string): string {
  return CANONICAL_CONCERNS.find((c) => c.slug === slug)?.name ?? slug;
}

function firstTreatmentForConcern(concernSlug: string): string {
  const c = CANONICAL_CONCERNS.find((x) => x.slug === concernSlug);
  const first = c?.serviceSlugs[0];
  return first ? slugToName(first) : "";
}

/** Update slot memory from a turn's extraction (deterministic, never model-set). */
export function updateSlots(
  prev: Slots,
  ex: Extraction,
  page: PageContext,
  effectiveLocation: string
): Slots {
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

  return {
    clinicInFocus,
    lastLocation: effectiveLocation || prev.lastLocation,
    treatmentsDiscussed,
  };
}
