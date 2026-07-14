/**
 * ingest/ai-extract-services.ts — AI extraction of the TREATMENTS/SERVICES a
 * clinic's website offers. Split out from ai-extract.ts (which now handles only
 * business details/locations/providers/images) so treatments can be refreshed
 * independently of the rest of a clinic's data — see ingest/ingest-services.ts.
 *
 * Same forced-tool contract as every other extractor in this pipeline: cheerio
 * gathers real candidates (nav mega-menu + services page), the AI judges which
 * are real public treatments vs. clinic-owned/junk, code (clinic-save.ts)
 * re-derives the canonical mapping — a bad AI guess can never invent a URL or
 * corrupt the stored raw offering.
 */

import { z } from "zod";
import { extractViaTool } from "@/lib/ai/anthropic";

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

const SYSTEM = `You extract the medspa/aesthetic TREATMENTS a clinic website offers, from its page text and a candidate list. You return data via the record_clinic_services tool only.

- Extract only MED-SPA / aesthetic / wellness treatments a user would search a med-spa directory for: injectables, skin/laser/facials, body contouring, hair, medical weight loss, hormone/peptide therapy, IV/vitamin therapy, sexual wellness, regenerative (PRP/PRF), and similar.
- EXCLUDE anything that is NOT an aesthetic/wellness treatment — OMIT it from the array entirely (do not include it with a null). In particular exclude urgent/primary/"quick" care visits (e.g. "Minor Quick Care", "Sick Visit", "Sinus Cocktail"), physicals (school/sports/DOT/employment), lab work / bloodwork / panels ("Laboratories"), vaccinations, diagnostics & body-composition/InBody assessments, and retail PRODUCT lines (e.g. "ZO Skin Health Skincare"). When the site groups these under a "Labs & Medical Services" / "Quick Care" / "Urgent Care" category, drop that whole group.
- raw_name: the service EXACTLY as written (KEEP ®/™ and brand words, e.g. "Botox®", "Morpheus8", "RUMA Gold Microchannel Treatment").
- public_decision:
  - "public" for real searchable treatment/service labels. Market-recognized brands, devices, drugs, and protocols CAN be public when users search them: Dysport, Sculptra, Radiesse, Renuva, Morpheus8, Sylfirm X RF Microneedling, MiraDry, BBL Laser, Exomind, EBOO/Ozone Therapy, IV Therapy, Hormone Therapy, Medical Weight Loss, etc.
  - "alias_only" for clinic-owned or confusing proprietary names that should help match the clinic but should NOT become a public treatment label. Example: "RUMA Gold Microchannel Treatment" → general_name "Microneedling".
  - "ignored" for category headings, blogs, shop, gift cards, specials, consultations, memberships, financing, and out-of-scope services. Cosmetic Dentistry / dental services are ALWAYS ignored for this directory.
- general_name: the clean PUBLIC treatment name to show/search. For public brands/devices, keep the brand/device when patient-recognized ("Dysport", "Morpheus8", "MiraDry"). For alias_only, use the generic related treatment ("Microneedling"). For combined labels that name multiple treatments ("Sculptra & Radiesse"), return one service item per public treatment, sharing the source_url if known.
- category: the group/category label the site shows (e.g. "Anti-Aging", "Laser Treatment"); else null.
- source_url: copy the exact candidate URL when available.
- Do NOT list category headers, memberships, gift cards, financing, or consultations as services. Do NOT invent services. Use ONLY the provided page text and candidates. Empty array if none.

- Call the record_clinic_services tool exactly once with your result.`;

// Per page, to bound token cost — mirrors ai-extract.ts's clinic-details cap.
const MAX_PAGE_CHARS = 16_000;

export interface ServicesExtractInput {
  domain: string;
  pages: Array<{ url: string; text: string }>;
  /** Service/treatment names harvested from nav + services page (the AI maps these). */
  serviceCandidates?: Array<{ name: string; category?: string | null; url?: string | null }>;
  /** Current general-treatment names the AI should reuse before inventing new ones. */
  knownTreatments?: string[];
  model?: string;
}

export interface ServicesExtractOutput {
  data: { services: ExtractedService[] };
  model: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
}

export interface ServicesRefineInput {
  domain: string;
  services: ExtractedService[];
  knownTreatments?: string[];
  model?: string;
}

export async function extractClinicServices(
  input: ServicesExtractInput
): Promise<ServicesExtractOutput> {
  const pageBlocks = input.pages
    .map((p) => `### PAGE: ${p.url}\n${p.text.slice(0, MAX_PAGE_CHARS)}`)
    .join("\n\n");

  const svcBlock = input.serviceCandidates?.length
    ? "\n\nSERVICE CANDIDATES (services linked in nav / on the services page — extract these plus any others in the text):\n" +
      input.serviceCandidates
        .map((c) => `- ${c.name}${c.category ? ` [category: ${c.category}]` : ""}${c.url ? ` → ${c.url}` : ""}`)
        .join("\n")
    : "";
  const treatBlock = input.knownTreatments?.length
    ? "\n\nKNOWN TREATMENTS (map each service's general_name to one of these when it fits; otherwise propose a new generic name):\n" +
      input.knownTreatments.map((t) => `- ${t}`).join("\n")
    : "";

  const user = [
    `Website domain: ${input.domain}`,
    `\nPage text follows. Extract every treatment/service this clinic offers.\n`,
    pageBlocks,
    svcBlock,
    treatBlock,
  ].join("\n");

  const { data, model, usage } = await extractViaTool<unknown>({
    system: SYSTEM,
    user,
    toolName: "record_clinic_services",
    toolDescription: "Record every treatment/service this clinic website offers.",
    inputSchema: TOOL_INPUT_SCHEMA,
    model: input.model,
    maxTokens: 4096,
  });

  const parsed = ServicesSchema.parse(data);
  return { data: parsed, model, usage };
}

const REFINE_SYSTEM = `You are the final quality gate for a medspa/plastic-surgery directory's treatment list. You receive candidate rows that an earlier extractor produced. Return ONLY real treatments/services/procedures that the clinic offers.

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
): Promise<ServicesExtractOutput> {
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
    maxTokens: 8_000,
  });

  const parsed = ServicesSchema.parse(data);
  return { data: parsed, model, usage };
}
