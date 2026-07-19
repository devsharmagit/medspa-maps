/**
 * One-pass AI extraction for a clinic's treatments and the patient concerns it
 * treats. Show the model the website content plus the live treatment/concern
 * catalogs, let it reuse catalog rows and propose new ones when the site clearly
 * names something new. Treatments and concerns are extracted as two independent
 * lists — the clinic-specific treatment→concern PAIRING was removed (it only fed
 * an unread table); re-add it later when a reader consumes it.
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

const ConcernSchema = z.object({
  raw_phrase: z.string(),
  general_name: z.string(),
  source_url: z.string().nullable(),
});

const CombinedSchema = z.object({
  treatments: z.array(TreatmentSchema),
  concerns: z.array(ConcernSchema),
});

export type ExtractedTreatment = z.infer<typeof TreatmentSchema>;
export type ExtractedStandaloneConcern = z.infer<typeof ConcernSchema>;

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
  },
  required: ["treatments", "concerns"],
};

const SYSTEM = `You extract a medspa clinic's treatments and the patient concerns/conditions it treats, as TWO independent lists, in ONE pass. You return data via the record_clinic_treatments_concerns tool only.

Think of two separate nouns:
- TREATMENT = the service/intervention/procedure/device/drug/protocol the clinic offers, such as Botox, Microneedling, Morpheus8, Laser Hair Removal, Chemical Peel, IV Therapy.
- CONCERN = the patient condition, symptom, or goal being solved, such as Acne Scars, Stretch Marks, Hyperpigmentation, Forehead Lines, Unwanted Hair, Low Energy.

Rules:
1. Use the supplied website content as the source. The SERVICE CANDIDATES list is a strong hint but not the only source.
2. Use KNOWN TREATMENTS and KNOWN CONCERNS when they are the same thing. If the clinic clearly offers/names a treatment or concern missing from the DB, output the new clean general_name so code can create it.
3. Do NOT turn concerns into fake treatments. "Acne scars", "stretch marks", "dark spots", "melasma", "forehead lines", "crow's feet", "unwanted hair" are concerns, not treatments.
4. Do NOT turn treatments into concerns. "Microneedling", "Botox", "Morpheus8", "HydraFacial", "Sculptra" are treatments, not concerns.
5. For treatments: include only medspa/aesthetic/wellness treatments. Exclude category headers, memberships, gift cards, financing, blog/shop pages, primary/urgent care, labs, diagnostics, vaccinations, physicals, and retail skincare product lines.
6. public_decision:
   - "public" for real searchable treatment labels, including patient-recognized brands/devices/drugs/protocols such as Dysport, Sculptra, Radiesse, Renuva, Morpheus8, Sylfirm X RF Microneedling, MiraDry, BBL Laser, Exomind, IV Therapy, Hormone Therapy, Medical Weight Loss.
   - "alias_only" for proprietary clinic names that should map to a generic public treatment, e.g. RUMA Gold Microchannel Treatment -> Microneedling.
   - "ignored" for non-treatments/out-of-scope items.
7. Keep concern names specific. Do not collapse Forehead Lines, Frown Lines, Bunny Lines, Crow's Feet, Acne Scars, Stretch Marks, Dark Spots, Melasma into broad buckets.
8. Fill concerns[] with EVERY concern/condition the site says it treats. If a "Conditions We Treat" / "Concerns" / "What We Treat" page (or section) lists conditions, add a concerns[] row for each listed condition — those pages are the highest-confidence concern source. Also capture concerns named in body prose (e.g. a page says the clinic treats "sun damage" and "uneven skin tone").
9. Set source_url to the page each concern/treatment came from when you can identify it. Do not include evidence quotes.

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
    "\nWebsite content follows. Extract the clinic's treatments and the concerns it treats as two separate lists.",
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
      "Record this clinic's treatments and the patient concerns it treats.",
    inputSchema: TOOL_INPUT_SCHEMA,
    model: input.model,
    maxTokens: 8_000,
  });

  const parsed = CombinedSchema.parse(data);
  return { treatments: parsed.treatments, concerns: parsed.concerns, model, usage };
}
