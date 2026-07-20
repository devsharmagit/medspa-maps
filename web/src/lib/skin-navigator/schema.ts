import { z } from "zod";

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
export const CONCERN_OPTIONS = [
  { slug: "acne", label: "Acne" },
  { slug: "wrinkles", label: "Wrinkles" },
  { slug: "pigmentation", label: "Pigmentation" },
  { slug: "hair-loss", label: "Hair loss" },
  { slug: "loose-skin", label: "Loose skin" },
  { slug: "dark-circles", label: "Dark circles" },
  { slug: "facial-volume", label: "Facial volume" },
  { slug: "redness", label: "Redness" },
  { slug: "pores", label: "Pores" },
  { slug: "texture", label: "Texture" },
  { slug: "scars", label: "Scars" },
  { slug: "double-chin", label: "Double chin" },
  { slug: "unwanted-hair", label: "Unwanted hair" },
] as const;

// Combined list (used for slug validation and label lookup). The request keeps a
// single `selected` array so downstream matching/prompting is unchanged; the UI
// and prompt split it back into goals vs concerns for clarity.
export const ALL_GOAL_OPTIONS = [...GOAL_OPTIONS, ...CONCERN_OPTIONS] as const;

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
      value: z.string().trim().min(2).max(120),
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

export const NavigatorConcernSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
  source: z.enum(["questionnaire", "photo", "both"]),
  severity: z.enum(["mild", "moderate", "significant", "unclear"]),
  rationale: z.string().trim().min(1).max(700),
});

export const NavigatorTreatmentSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  priority: z.enum(["primary", "secondary", "maintenance"]),
  confidence: z.enum(["low", "medium", "high"]),
  whyItFits: z.string().trim().min(1).max(900),
  expectedDowntime: z.string().trim().min(1).max(160),
  comfortNotes: z.string().trim().min(1).max(300),
  cautions: z.array(z.string().trim().min(1).max(220)).max(5),
});

export const NavigatorAnalysisSchema = z.object({
  concerns: z.array(NavigatorConcernSchema).max(6),
  recommendedTreatments: z.array(NavigatorTreatmentSchema).min(1).max(5),
  alternatives: z
    .array(
      z.object({
        slug: z.string().trim().min(1).max(120),
        name: z.string().trim().min(1).max(120),
        rationale: z.string().trim().min(1).max(500),
      })
    )
    .max(4),
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
  "This is informational cosmetic guidance, not medical advice or a diagnosis. Results vary, and a qualified provider should confirm which treatments are appropriate for you.";

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
