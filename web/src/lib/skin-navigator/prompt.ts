import type { NavigatorRequest } from "./schema";
import { NAVIGATOR_DISCLAIMER, selectedGoalLabels, splitGoalSelection } from "./schema";

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

export const NAVIGATOR_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    concerns: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          slug: { type: "string" },
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
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          slug: { type: "string" },
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
    alternatives: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          slug: { type: "string" },
          name: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["slug", "name", "rationale"],
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
    "alternatives",
    "photoObservations",
    "consultationQuestions",
    "disclaimer",
  ],
} satisfies Record<string, unknown>;

export function buildNavigatorSystemPrompt(): string {
  return [
    "You are the MedSpaMaps AI Treatment Navigator.",
    "Your job is to provide informational cosmetic treatment education and help users prepare for a provider consultation.",
    "You must never diagnose medical conditions, identify disease, or guarantee results.",
    "Treat uploaded photos only as visible cosmetic observations such as texture, redness, pigment appearance, acne-like blemishes, pores, fine lines, or volume/laxity cues.",
    "Do not infer protected attributes from photos. Do not identify ethnicity, exact age, health status, or sensitive traits from images.",
    "If the user mentions unusual lesions, infection, severe sudden symptoms, pregnancy-related safety questions, sudden hair loss, medication conflicts, or anything medical, advise consultation with a qualified clinician before cosmetic treatment.",
    "Do not ask or mention budget. Keep recommendations concise, calm, and non-alarming.",
    "Prefer canonical treatment and concern slugs from the provided catalog. If a perfect slug is unavailable, use the closest safe canonical option.",
    `Always include a disclaimer consistent with: ${NAVIGATOR_DISCLAIMER}`,
  ].join("\n");
}

export function buildNavigatorUserPrompt(
  request: NavigatorRequest,
  catalog: NavigatorPromptCatalog,
  hasPhotos: boolean
): string {
  const compactCatalog = {
    treatments: catalog.treatments.slice(0, 80).map((t) => ({
      slug: t.slug,
      name: t.name,
      summary: t.summary,
      aliases: t.aliases ?? [],
    })),
    concerns: catalog.concerns.slice(0, 80).map((c) => ({
      slug: c.slug,
      name: c.name,
      summary: c.summary,
      aliases: c.aliases ?? [],
    })),
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
        "Recommend 2 to 4 primary/secondary treatments when appropriate.",
        "Use low confidence when the inputs are sparse or photo quality limits observation.",
        "Use gentle/low-downtime options when the user prefers gentle care or no downtime.",
        "If photos are not provided, keep photoObservations.provided false and explain that visual assessment was not included.",
        "Do not diagnose acne, rosacea, melasma, alopecia, or any medical condition; phrase as cosmetic concerns or visible signs.",
      ],
    },
    null,
    2
  );
}
