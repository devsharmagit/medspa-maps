/**
 * One-pass AI extraction for a clinic's treatments AND the concerns each
 * treatment solves. This intentionally trades some evidence machinery for a
 * simple brute-force layer: show the model the website content plus the live
 * treatment/concern catalogs, let it decide which catalog rows to reuse, and
 * let it propose new catalog rows when the site clearly names something new.
 */

import { z } from "zod";
import { extractViaTool } from "@/lib/ai/anthropic";

const TreatmentSchema = z.object({
  raw_name: z.string(),
  general_name: z.string().nullable(),
  category: z.string().nullable(),
  source_url: z.string().nullable(),
  public_decision: z.enum(["public", "alias_only", "ignored"]).default("public"),
});

const MappingSchema = z.object({
  service_raw_name: z.string().nullable(),
  service_general_name: z.string(),
  concern_raw_phrase: z.string(),
  concern_general_name: z.string(),
  source_url: z.string().nullable(),
});

const ConcernSchema = z.object({
  raw_phrase: z.string(),
  general_name: z.string(),
  source_url: z.string().nullable(),
});

const CombinedSchema = z.object({
  treatments: z.array(TreatmentSchema),
  concerns: z.array(ConcernSchema),
  mappings: z.array(MappingSchema),
});

export type ExtractedTreatment = z.infer<typeof TreatmentSchema>;
export type ExtractedStandaloneConcern = z.infer<typeof ConcernSchema>;
export type ExtractedTreatmentConcernMapping = z.infer<typeof MappingSchema>;

const TOOL_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    treatments: {
      type: "array",
      description:
        "Every real treatment/service this clinic offers. Reuse known treatments where appropriate; propose new public treatment names when the clinic clearly offers one that is missing.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          raw_name: {
            type: "string",
            description: "Treatment exactly as written by the clinic, keeping brand words and symbols.",
          },
          general_name: {
            type: ["string", "null"],
            description:
              "Clean public treatment name. Use an existing known treatment when it fits; otherwise create the best new public treatment name. null only when ignored.",
          },
          category: { type: ["string", "null"] },
          source_url: {
            type: ["string", "null"],
            description: "Best page URL where this treatment appears.",
          },
          public_decision: {
            type: "string",
            enum: ["public", "alias_only", "ignored"],
            description:
              "public = public/searchable treatment; alias_only = proprietary clinic label that maps to general_name; ignored = not a medspa treatment.",
          },
        },
        required: ["raw_name", "general_name", "category", "source_url", "public_decision"],
      },
    },
    concerns: {
      type: "array",
      description:
        "Every patient concern/condition this clinic explicitly says it treats or addresses, even when no exact treatment is paired on the page.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          raw_phrase: {
            type: "string",
            description: "Concern/condition phrase as the site names it.",
          },
          general_name: {
            type: "string",
            description:
              "Clean patient-facing concern name. Reuse an existing known concern when it is the same specific condition; otherwise create a new specific concern.",
          },
          source_url: {
            type: ["string", "null"],
            description: "Best page URL where this concern is named.",
          },
        },
        required: ["raw_phrase", "general_name", "source_url"],
      },
    },
    mappings: {
      type: "array",
      description:
        "Clinic-specific treatment -> concern pairs. Each row means this clinic solves this concern with this treatment.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          service_raw_name: {
            type: ["string", "null"],
            description:
              "The raw treatment name from treatments[] when known. Use null only if the page names only a general treatment.",
          },
          service_general_name: {
            type: "string",
            description:
              "The clean treatment name from treatments[]. Must be a treatment/procedure/product/device, not a concern.",
          },
          concern_raw_phrase: {
            type: "string",
            description: "The patient condition/concern phrase as the site names it.",
          },
          concern_general_name: {
            type: "string",
            description:
              "Clean patient-facing concern name. Reuse an existing known concern when it is the same specific condition; otherwise create a new specific concern.",
          },
          source_url: {
            type: ["string", "null"],
            description: "Best page URL supporting this treatment-concern pair, when identifiable.",
          },
        },
        required: [
          "service_raw_name",
          "service_general_name",
          "concern_raw_phrase",
          "concern_general_name",
          "source_url",
        ],
      },
    },
  },
  required: ["treatments", "concerns", "mappings"],
};

const SYSTEM = `You extract a medspa clinic's treatments and the patient concerns/conditions each treatment solves in ONE pass. You return data via the record_clinic_treatments_concerns tool only.

Think of two separate nouns:
- TREATMENT = the service/intervention/procedure/device/drug/protocol the clinic offers, such as Botox, Microneedling, Morpheus8, Laser Hair Removal, Chemical Peel, IV Therapy.
- CONCERN = the patient condition, symptom, or goal being solved, such as Acne Scars, Stretch Marks, Hyperpigmentation, Forehead Lines, Unwanted Hair, Low Energy.

Rules:
1. Use the supplied website content as the source. The SERVICE CANDIDATES list is a strong hint but not the only source.
2. Use KNOWN TREATMENTS and KNOWN CONCERNS when they are the same thing. If the clinic clearly offers/names a treatment or concern missing from the DB, output the new clean general_name so code can create it.
3. Do NOT turn concerns into fake treatments. "Acne scars", "stretch marks", "dark spots", "melasma", "forehead lines", "crow's feet", "unwanted hair" are concerns. Do not map them to "Acne Treatment" or similar unless the site literally names an actual treatment with that name.
4. Do NOT turn treatments into concerns. "Microneedling", "Botox", "Morpheus8", "HydraFacial", "Sculptra" are treatments, not concerns.
5. For treatments: include only medspa/aesthetic/wellness treatments. Exclude category headers, memberships, gift cards, financing, blog/shop pages, primary/urgent care, labs, diagnostics, vaccinations, physicals, and retail skincare product lines.
6. public_decision:
   - "public" for real searchable treatment labels, including patient-recognized brands/devices/drugs/protocols such as Dysport, Sculptra, Radiesse, Renuva, Morpheus8, Sylfirm X RF Microneedling, MiraDry, BBL Laser, Exomind, IV Therapy, Hormone Therapy, Medical Weight Loss.
   - "alias_only" for proprietary clinic names that should map to a generic public treatment, e.g. RUMA Gold Microchannel Treatment -> Microneedling.
   - "ignored" for non-treatments/out-of-scope items.
7. For mappings: emit a row only when the page context says or strongly indicates that THIS treatment addresses THIS concern. A treatment page headed "What it treats", "Concerns treated", or a bullet list on that treatment page is enough.
8. Keep concern names specific. Do not collapse Forehead Lines, Frown Lines, Bunny Lines, Crow's Feet, Acne Scars, Stretch Marks, Dark Spots, Melasma into broad buckets.
9. If a page lists one treatment addressing multiple concerns, emit one mapping per concern. If multiple treatments address the same concern, emit one mapping per treatment.
10. Also fill concerns[] with every concern/condition the site says it treats, even when you cannot pair it to a treatment. Example: a general page says the clinic treats "sun damage" and "uneven skin tone" but does not name a specific service; add concerns[] rows for both, and add mappings[] only when a treatment is clear.
11. Do not include evidence quotes. Use source_url when you can identify the page.

Call the record_clinic_treatments_concerns tool exactly once.`;

const MAX_PAGE_CHARS = 6_000;

export interface TreatmentsConcernsExtractInput {
  domain: string;
  pages: Array<{ url: string; text: string }>;
  serviceCandidates?: Array<{ name: string; category?: string | null; url?: string | null }>;
  knownTreatments: string[];
  knownConcerns: string[];
  model?: string;
}

export interface TreatmentsConcernsExtractOutput {
  treatments: ExtractedTreatment[];
  concerns: ExtractedStandaloneConcern[];
  mappings: ExtractedTreatmentConcernMapping[];
  model: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
}

export async function extractClinicTreatmentsConcerns(
  input: TreatmentsConcernsExtractInput
): Promise<TreatmentsConcernsExtractOutput> {
  const pageBlocks = input.pages
    .map((p) => `### PAGE: ${p.url}\n${p.text.slice(0, MAX_PAGE_CHARS)}`)
    .join("\n\n");

  const svcBlock = input.serviceCandidates?.length
    ? "\n\nSERVICE CANDIDATES (raw names/URLs found in nav and service pages):\n" +
      input.serviceCandidates
        .map((c) => `- ${c.name}${c.category ? ` [category: ${c.category}]` : ""}${c.url ? ` -> ${c.url}` : ""}`)
        .join("\n")
    : "";
  const treatmentBlock = input.knownTreatments.length
    ? "\n\nKNOWN TREATMENTS IN DB (reuse when same; otherwise create a new treatment general_name):\n" +
      input.knownTreatments.map((t) => `- ${t}`).join("\n")
    : "";
  const concernBlock = input.knownConcerns.length
    ? "\n\nKNOWN CONCERNS IN DB (reuse when same specific concern; otherwise create a new concern general_name):\n" +
      input.knownConcerns.map((c) => `- ${c}`).join("\n")
    : "";

  const user = [
    `Website domain: ${input.domain}`,
    "\nWebsite content follows. Extract treatments and treatment->concern mappings together.",
    pageBlocks,
    svcBlock,
    treatmentBlock,
    concernBlock,
  ].join("\n");

  const { data, model, usage } = await extractViaTool<unknown>({
    system: SYSTEM,
    user,
    toolName: "record_clinic_treatments_concerns",
    toolDescription:
      "Record this clinic's treatments and the patient concerns each treatment addresses.",
    inputSchema: TOOL_INPUT_SCHEMA,
    model: input.model,
    maxTokens: 12_000,
  });

  const parsed = CombinedSchema.parse(data);
  return { treatments: parsed.treatments, concerns: parsed.concerns, mappings: parsed.mappings, model, usage };
}
