/**
 * ingest/ai-refine-services.ts — the second AI pass over a clinic's treatment
 * list: a quality gate that drops non-treatments the first extractor let
 * through and normalizes the survivors.
 *
 * Extracted from the retired `ai-extract-services.ts`, whose first-pass
 * extractor was superseded by `ai-extract-treatments-concerns.ts`.
 */
import { z } from "zod";
import { domainSeed, extractViaTool } from "@/lib/ai/anthropic";

const ServiceItemSchema = z.object({
  raw_name: z.string(), // service exactly as written on the site (keep ®/™, brand words)
  general_name: z.string().nullable(), // public treatment name it maps to
  category: z.string().nullable(),
  source_url: z.string().nullable(),
  public_decision: z.enum(["public", "alias_only", "ignored"]).default("public"),
});

const ServicesSchema = z.object({
  services: z.array(ServiceItemSchema),
});

export type ExtractedService = z.infer<typeof ServiceItemSchema>;
const TOOL_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    services: {
      type: "array",
      description: "MED-SPA / aesthetic / wellness treatments only (from nav + services page). OMIT non-aesthetic items entirely — urgent/primary/quick care, physicals, labs, vaccinations, diagnostics/body-composition, retail product lines. [] if none.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          raw_name: { type: "string", description: "The service EXACTLY as written on the site (keep ®/™ and brand words, e.g. 'Botox®', 'RUMA Gold Microchannel Treatment')" },
          general_name: {
            type: ["string", "null"],
            description: "The public/searchable treatment name. Use real market-recognized brand/device/drug names when patients search them (e.g. Dysport, Morpheus8, MiraDry). For clinic-owned names use the generic public treatment (e.g. RUMA Gold Microchannel Treatment → Microneedling). null only when public_decision is ignored.",
          },
          category: { type: ["string", "null"], description: "Group/category label if shown (e.g. 'Anti-Aging', 'Laser Treatment')" },
          source_url: { type: ["string", "null"], description: "The service detail URL copied from SERVICE CANDIDATES when present; otherwise null." },
          public_decision: {
            type: "string",
            enum: ["public", "alias_only", "ignored"],
            description: "public = show/search this treatment label; alias_only = save/link it under general_name but do not expose raw_name as a public label; ignored = non-service/out-of-scope/junk such as dentistry, gift cards, shop/blog, category headings.",
          },
        },
        required: ["raw_name", "general_name", "category", "source_url", "public_decision"],
      },
    },
  },
  required: ["services"],
};

export interface ServicesRefineInput {
  domain: string;
  services: ExtractedService[];
  knownTreatments?: string[];
  model?: string;
}

export interface ServicesRefineOutput {
  data: z.infer<typeof ServicesSchema>;
  model: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
}

const REFINE_SYSTEM =`You are the final quality gate for a medspa/plastic-surgery directory's treatment list. You receive candidate rows that an earlier extractor produced. Return ONLY real treatments/services/procedures that the clinic offers.

Keep:
- real aesthetic/plastic surgery/medspa/wellness procedures: Botox, Dysport, Blepharoplasty, Breast Augmentation, Abdominoplasty, Liposuction, Facelift, Laser Hair Removal, IPL, CO2 Laser Resurfacing, HydraFacial, PRF Microneedling, Hormone Therapy, Peptide Therapy, Medical Weight Loss, etc.

Drop:
- category headings: BODY, BREAST, FACE, FOR MEN, SURGICAL, NON SURGICAL, Medical Spa Services.
- navigation/CTA/site chrome: HTML Sitemap, Request an Appointment, Services, FAQ.
- blog/article titles: "How ...", "Top 5 ...", "A closer look ...", "Maintaining ...", "... Benefits", "... FAQs", educational headlines.
- concerns/goals/body text that are not offered procedures: reduced libido, skin texture and tone, acne scars, wrinkles, dark spots.
- retail/product-line content unless it is clearly sold as a treatment service.

Rewrite:
- SEO titles like "Botox Injections in Bismarck, ND" -> raw_name "Botox", general_name "Botox".
- "Dysport Injections in City, ST" -> "Dysport"; "Radiofrequency Microneedling in City, ST" -> "Radiofrequency Microneedling".
- Article titles with a real treatment prefix like "CoolTone: How It Works, Benefits, And FAQs" -> "CoolTone" only.

If a row is a combined real treatment, keep it only when it is a normal public service label. Do not invent services that are not in the input. Call the tool exactly once.`;

export async function refineClinicServices(
  input: ServicesRefineInput
): Promise<ServicesRefineOutput> {
  if (!input.services?.length) {
    return { data: { services: [] }, model: input.model ?? "", usage: null };
  }

  const svcBlock = input.services
    .map((s, i) =>
      `${i + 1}. raw_name: ${s.raw_name}\n` +
      `   general_name: ${s.general_name ?? "null"}\n` +
      `   category: ${s.category ?? "null"}\n` +
      `   source_url: ${s.source_url ?? "null"}\n` +
      `   public_decision: ${s.public_decision}`
    )
    .join("\n");
  const treatBlock = input.knownTreatments?.length
    ? "\n\nKNOWN TREATMENTS IN DB (reuse exact names when appropriate):\n" +
      input.knownTreatments.map((t) => `- ${t}`).join("\n")
    : "";

  const { data, model, usage } = await extractViaTool<unknown>({
    system: REFINE_SYSTEM,
    user: [
      `Website domain: ${input.domain}`,
      "Review and clean these candidate treatment rows. Return only final public treatment/service rows.",
      svcBlock,
      treatBlock,
    ].join("\n\n"),
    toolName: "record_clinic_services",
    toolDescription: "Record the final cleaned treatment/service list for this clinic.",
    inputSchema: TOOL_INPUT_SCHEMA,
    model: input.model,
    seed: domainSeed(input.domain),
    maxTokens: 8_000,
  });

  const parsed = ServicesSchema.parse(data);
  return { data: parsed, model, usage };
}
