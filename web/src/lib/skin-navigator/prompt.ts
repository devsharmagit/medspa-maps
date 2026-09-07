import type { NavigatorRequest } from "./schema";
import { NAVIGATOR_DISCLAIMER, selectedGoalLabels, splitGoalSelection } from "./schema";
import { CORE_CONCERN_SLUGS, CORE_TREATMENT_SLUGS } from "@/lib/taxonomy/core-catalog";

export interface NavigatorCatalogItem {
  slug: string;
  name: string;
  summary: string | null;
  aliases?: string[] | null;
}

export interface NavigatorPromptCatalog {
  treatments: NavigatorCatalogItem[];
  concerns: NavigatorCatalogItem[];
}

/**
 * The forced-tool JSON schema.
 *
 * Both `slug` fields are enum-bound to the real catalog. The call runs with
 * `strict: true` (lib/ai/openai.ts), so an off-catalog treatment or concern is
 * structurally impossible rather than merely discouraged by the prompt — which
 * is what it was until 2026-09-07, when `slug` was a bare `{ type: "string" }`.
 */
export const NAVIGATOR_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    concerns: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          slug: { type: "string", enum: [...CORE_CONCERN_SLUGS] },
          label: { type: "string" },
          source: { type: "string", enum: ["questionnaire", "photo", "both"] },
          severity: {
            type: "string",
            enum: ["mild", "moderate", "significant", "unclear"],
          },
          rationale: { type: "string" },
        },
        required: ["slug", "label", "source", "severity", "rationale"],
      },
    },
    recommendedTreatments: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          slug: { type: "string", enum: [...CORE_TREATMENT_SLUGS] },
          name: { type: "string" },
          priority: {
            type: "string",
            enum: ["primary", "secondary", "maintenance"],
          },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          whyItFits: { type: "string" },
          expectedDowntime: { type: "string" },
          comfortNotes: { type: "string" },
          cautions: {
            type: "array",
            maxItems: 5,
            items: { type: "string" },
          },
        },
        required: [
          "slug",
          "name",
          "priority",
          "confidence",
          "whyItFits",
          "expectedDowntime",
          "comfortNotes",
          "cautions",
        ],
      },
    },
    photoObservations: {
      type: "object",
      additionalProperties: false,
      properties: {
        provided: { type: "boolean" },
        notes: {
          type: "array",
          maxItems: 6,
          items: { type: "string" },
        },
        limitations: {
          type: "array",
          maxItems: 4,
          items: { type: "string" },
        },
      },
      required: ["provided", "notes", "limitations"],
    },
    consultationQuestions: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string" },
    },
    disclaimer: { type: "string" },
  },
  required: [
    "concerns",
    "recommendedTreatments",
    "photoObservations",
    "consultationQuestions",
    "disclaimer",
  ],
} satisfies Record<string, unknown>;

export function buildNavigatorSystemPrompt(): string {
  return [
    "You are the Medspa Maps AI Treatment Navigator.",
    "Your job is to provide informational cosmetic treatment education and help users prepare for a provider consultation.",
    "You must never diagnose medical conditions, identify disease, or guarantee results.",
    "Treat uploaded photos only as visible cosmetic observations such as texture, redness, pigment appearance, acne-like blemishes, pores, fine lines, or volume/laxity cues.",
    "Do not infer protected attributes from photos. Do not identify ethnicity, exact age, health status, or sensitive traits from images.",
    "If the user mentions unusual lesions, infection, severe sudden symptoms, pregnancy-related safety questions, sudden hair loss, medication conflicts, or anything medical, advise consultation with a qualified clinician before cosmetic treatment.",
    "Do not ask or mention budget. Keep recommendations concise, calm, and non-alarming.",
    "The catalog you are given is COMPLETE and CLOSED: it is every treatment and concern this site covers. Use only slugs from it — never invent one, never name a treatment that is not in it, and do not mention brand or device names that are absent from it.",
    "If nothing in the catalog fits a concern the user raised, leave it out and say a provider can advise on it. Returning the closest catalog entry is better than inventing, but omitting is better than a poor fit.",
    `Always include a disclaimer consistent with: ${NAVIGATOR_DISCLAIMER}`,
  ].join("\n");
}

export function buildNavigatorUserPrompt(
  request: NavigatorRequest,
  catalog: NavigatorPromptCatalog,
  hasPhotos: boolean,
  associations?: Record<string, { slug: string; name: string }[]>
): string {
  // No slice. The catalog is 19 treatments / 14 concerns and every one of them
  // is in the tool schema's enum, so truncating here would show the model less
  // than it is allowed to return. (It used to slice to 80 against a SQL
  // LIMIT 120, which silently hid 40 rows back when the catalog was large.)
  const compactCatalog = {
    treatments: catalog.treatments.map((t) => ({
      slug: t.slug,
      name: t.name,
      summary: t.summary,
      aliases: t.aliases ?? [],
    })),
    concerns: catalog.concerns.map((c) => ({
      slug: c.slug,
      name: c.name,
      summary: c.summary,
      aliases: c.aliases ?? [],
    })),
    // Treatments most commonly offered by clinics that treat each of THIS
    // user's concerns (derived from real clinic data). Prefer these slugs.
    associations: associations ?? {},
  };

  return JSON.stringify(
    {
      task:
        "Create a structured cosmetic treatment navigation result for this user. Return only the forced tool JSON.",
      userInput: {
        ...request,
        goalLabels: selectedGoalLabels(request),
        // Split for clarity: aspirational goals vs. specific concerns to fix.
        goals: splitGoalSelection(request).goals,
        concernsToFix: splitGoalSelection(request).concerns,
        photosProvided: hasPhotos,
      },
      catalog: compactCatalog,
      rules: [
        "Return exactly 3 to 5 concerns and 3 to 5 recommended treatments.",
        "catalog.treatments and catalog.concerns are the COMPLETE set of slugs you may return — nothing else exists on this site. Both fields are enum-validated, so an invented slug is rejected outright.",
        "Within that set, prefer treatment slugs from catalog.associations for the user's concerns; they map to real, locally-available clinics.",
        "Never name a treatment, device or brand that is absent from catalog.treatments, not even as an aside or a comparison — the user cannot search for it here.",
        "Use low confidence when the inputs are sparse or photo quality limits observation.",
        "Use gentle/low-downtime options when the user prefers gentle care or no downtime.",
        "If photos are not provided, keep photoObservations.provided false, and every concern's source MUST be \"questionnaire\" (never \"photo\" or \"both\").",
        "Do not diagnose acne, rosacea, melasma, alopecia, or any medical condition; phrase as cosmetic concerns or visible signs.",
      ],
    },
    null,
    2
  );
}
