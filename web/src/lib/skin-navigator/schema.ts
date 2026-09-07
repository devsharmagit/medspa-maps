import { z } from "zod";

import {
  CORE_CONCERNS,
  CORE_CONCERN_SLUGS,
  CORE_TREATMENT_SLUGS,
} from "@/lib/taxonomy/core-catalog";

export const AGE_RANGES = [
  "under-25",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65-plus",
] as const;

// Aspirational goals — "what's your overall goal?"
export const GOAL_OPTIONS = [
  { slug: "look-younger", label: "Look younger" },
  { slug: "look-refreshed", label: "Look refreshed" },
  { slug: "event-ready", label: "Glow up for an event" },
  { slug: "natural-maintenance", label: "Natural maintenance" },
] as const;

// Concerns / symptoms — "what would you like to fix?"
//
// DERIVED, never hand-written. These have to be real concern slugs:
// associations.ts looks each one up in the concern→treatment co-occurrence map
// by slug, so a chip whose slug is not in the `concerns` table silently
// produces no recommendations at all. That invisible failure is exactly how
// this list drifted before (it once carried its own vocabulary — loose-skin,
// facial-volume, redness, pores, texture, scars, double-chin, dark-circles,
// unwanted-hair — none of which were catalog slugs).
//
// The label is the catalog's own name, so a chip here reads identically to the
// same concern in the search dropdown and on /conditions. It used to carry
// conversational rewrites ("Loose skin" for skin-laxity, "Texture & pores" for
// uneven-skin-texture, "Veins & redness" for veins), which made users read the
// page as offering concerns the site does not list.
//
// Same pattern as src/app/conditions/page.tsx:33.
export const CONCERN_OPTIONS: readonly { slug: string; label: string }[] =
  CORE_CONCERNS.map((c) => ({ slug: c.slug, label: c.name }));

// Combined list (used for slug validation and label lookup). The request keeps a
// single `selected` array so downstream matching/prompting is unchanged; the UI
// and prompt split it back into goals vs concerns for clarity.
export const ALL_GOAL_OPTIONS: readonly { slug: string; label: string }[] = [
  ...GOAL_OPTIONS,
  ...CONCERN_OPTIONS,
];

const GOAL_SLUGS = new Set<string>(GOAL_OPTIONS.map((g) => g.slug));
const CONCERN_SLUGS = new Set<string>(CONCERN_OPTIONS.map((c) => c.slug));

export const isGoalSlug = (slug: string) => GOAL_SLUGS.has(slug);
export const isConcernSlug = (slug: string) => CONCERN_SLUGS.has(slug);

const GoalSlugSchema = z.enum(
  ALL_GOAL_OPTIONS.map((g) => g.slug) as [string, ...string[]]
);

export const NavigatorRequestSchema = z.object({
  basics: z.object({
    ageRange: z.enum(AGE_RANGES),
    gender: z.string().trim().max(80).optional().default(""),
    skinTone: z.string().trim().max(80).optional().default(""),
    location: z.object({
      // Optional: users can get concerns + treatments without a location.
      // When empty, the clinics section is skipped entirely.
      value: z.string().trim().max(120).optional().default(""),
      label: z.string().trim().max(160).optional().default(""),
      lat: z.number().finite().nullable().optional().default(null),
      lng: z.number().finite().nullable().optional().default(null),
    }),
  }),
  goals: z.object({
    selected: z.array(GoalSlugSchema).min(1).max(8),
    freeText: z.string().trim().max(800).optional().default(""),
  }),
  preferences: z.object({
    previousTreatments: z.enum(["none", "yes", "not-sure"]),
    downtime: z.enum(["none", "few-days", "flexible"]),
    comfort: z.enum(["gentle", "injectables-devices", "not-sure"]),
    medicalConsiderations: z.string().trim().max(800).optional().default(""),
  }),
});

export type NavigatorRequest = z.infer<typeof NavigatorRequestSchema>;

/**
 * The model's vocabulary is CLOSED to the 19 core treatments / 14 core concerns.
 *
 * `slug` used to be a free `z.string()`, with the catalog offered to the model
 * as advice only. That let it name a treatment the site does not list: the card
 * still rendered (just without a "Find practices" button), and an off-catalog
 * CONCERN slug silently matched zero clinics in matchByConcerns, which compares
 * it verbatim against `concerns.slug`.
 *
 * The provider's JSON schema (prompt.ts NAVIGATOR_TOOL_SCHEMA) carries the same
 * enum and runs with `strict: true`, so this is the second of two gates: it
 * turns a provider that ignores the enum into a parse failure rather than a
 * rendered recommendation.
 *
 * `label`/`name` stay free text but are NOT displayed — the UI renders the
 * catalog's own name looked up by slug. They are kept because the model writes
 * them anyway and they are useful in the persisted ai_response.
 */
export const NavigatorConcernSchema = z.object({
  slug: z.enum(CORE_CONCERN_SLUGS as unknown as [string, ...string[]]),
  label: z.string().trim().min(1).max(120),
  source: z.enum(["questionnaire", "photo", "both"]),
  severity: z.enum(["mild", "moderate", "significant", "unclear"]),
  rationale: z.string().trim().min(1).max(700),
});

export const NavigatorTreatmentSchema = z.object({
  slug: z.enum(CORE_TREATMENT_SLUGS as unknown as [string, ...string[]]),
  name: z.string().trim().min(1).max(120),
  priority: z.enum(["primary", "secondary", "maintenance"]),
  confidence: z.enum(["low", "medium", "high"]),
  whyItFits: z.string().trim().min(1).max(900),
  expectedDowntime: z.string().trim().min(1).max(160),
  comfortNotes: z.string().trim().min(1).max(300),
  cautions: z.array(z.string().trim().min(1).max(220)).max(5),
});

export const NavigatorAnalysisSchema = z.object({
  concerns: z.array(NavigatorConcernSchema).min(3).max(5),
  recommendedTreatments: z.array(NavigatorTreatmentSchema).min(3).max(5),
  photoObservations: z.object({
    provided: z.boolean(),
    notes: z.array(z.string().trim().min(1).max(260)).max(6),
    limitations: z.array(z.string().trim().min(1).max(260)).max(4),
  }),
  consultationQuestions: z.array(z.string().trim().min(1).max(220)).min(1).max(5),
  disclaimer: z.string().trim().min(1).max(700),
});

export type NavigatorAnalysis = z.infer<typeof NavigatorAnalysisSchema>;

export interface NavigatorClinicMatch {
  clinicId: string;
  name: string;
  slug: string;
  profileUrl: string;
  distanceMiles: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  rating: number | null;
  reviewCount: number;
  verified: boolean;
  featured: boolean;
  website: string | null;
  bookingUrl: string | null;
  coverImageUrl: string | null;
  logoUrl: string | null;
  matchedTreatments: { name: string; slug: string }[];
  matchScore: number;
}

export interface NavigatorAnalyzeResponse {
  sessionId: string | null;
  analysis: NavigatorAnalysis;
  clinics: NavigatorClinicMatch[];
  disclaimer: string;
}

export const NavigatorEventSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  eventName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_.-]+$/i),
  step: z.string().trim().max(80).optional(),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export type NavigatorEvent = z.infer<typeof NavigatorEventSchema>;

export const NAVIGATOR_DISCLAIMER =
  "** The information you provide will be leveraged by AI to create a conceptual treatment plan. Responses provided do not constitute medical advice and have not been reviewed by a medical professional. The information you share will not be sold to a third-party.";

const LABELS = new Map<string, string>(ALL_GOAL_OPTIONS.map((g) => [g.slug, g.label]));

export function selectedGoalLabels(request: NavigatorRequest): string[] {
  return request.goals.selected.map((slug) => LABELS.get(slug) ?? slug);
}

/** Split the user's picks into aspirational goals vs. concerns, as labels. */
export function splitGoalSelection(request: NavigatorRequest): {
  goals: string[];
  concerns: string[];
} {
  const goals: string[] = [];
  const concerns: string[] = [];
  for (const slug of request.goals.selected) {
    const label = LABELS.get(slug) ?? slug;
    if (isConcernSlug(slug)) concerns.push(label);
    else goals.push(label);
  }
  return { goals, concerns };
}
