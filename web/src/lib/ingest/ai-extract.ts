/**
 * ingest/ai-extract.ts — AI extraction of BASIC clinic details from page text.
 *
 * The AI is the source of truth for correctness: it reads the actual page text
 * and returns each field / physical location in context (fixing the heuristic
 * scraper's address mis-attribution). It extracts ONLY basic clinic details +
 * every physical location — NOT treatments, providers, concerns, or reviews.
 */

import { z } from "zod";
import { extractViaTool } from "@/lib/ai/anthropic";

// ── Validated output shape ────────────────────────────────────────────────────
const LocationSchema = z.object({
  label: z.string().nullable(),
  address: z.string().nullable(), // full street address for THIS location
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  phone: z.string().nullable(),
  hours: z.string().nullable(), // free-text hours, e.g. "Mon–Fri 9am–5pm"
});

const ExtractSchema = z.object({
  business_name: z.string().nullable(),
  about: z.string().nullable(),
  tagline: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  booking_url: z.string().nullable(),
  instagram_url: z.string().nullable(),
  facebook_url: z.string().nullable(),
  tiktok_url: z.string().nullable(),
  youtube_url: z.string().nullable(),
  x_url: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  yelp_url: z.string().nullable(),
  locations: z.array(LocationSchema),
});

export type ExtractedLocation = z.infer<typeof LocationSchema>;
export type ExtractedClinic = z.infer<typeof ExtractSchema>;

// JSON Schema mirror for the forced tool call (scalars nullable; locations required).
const NULLABLE_STR = { type: ["string", "null"] };
const TOOL_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    business_name: NULLABLE_STR,
    about: NULLABLE_STR,
    tagline: NULLABLE_STR,
    phone: NULLABLE_STR,
    email: NULLABLE_STR,
    booking_url: NULLABLE_STR,
    instagram_url: NULLABLE_STR,
    facebook_url: NULLABLE_STR,
    tiktok_url: NULLABLE_STR,
    youtube_url: NULLABLE_STR,
    x_url: NULLABLE_STR,
    linkedin_url: NULLABLE_STR,
    yelp_url: NULLABLE_STR,
    locations: {
      type: "array",
      description: "Every distinct physical location (clinic address) on the site.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: ["string", "null"], description: "Branch/city name, e.g. 'Austin' or 'Downtown'" },
          address: { type: ["string", "null"], description: "Full street address incl. suite" },
          city: NULLABLE_STR,
          state: { type: ["string", "null"], description: "2-letter state code if determinable" },
          zip: NULLABLE_STR,
          phone: NULLABLE_STR,
          hours: { type: ["string", "null"], description: "Opening hours as free text" },
        },
        required: ["label", "address", "city", "state", "zip", "phone", "hours"],
      },
    },
  },
  required: [
    "business_name", "about", "tagline", "phone", "email", "booking_url",
    "instagram_url", "facebook_url", "tiktok_url", "youtube_url", "x_url",
    "linkedin_url", "yelp_url", "locations",
  ],
};

const SYSTEM = `You extract structured medspa/clinic information from website page text.

Rules:
- Use ONLY the provided page text. Do NOT invent or guess values.
- Return null for any field not present in the text.
- Return EVERY distinct physical location (address) you find — a business may have
  many. Give each location its own address, city, state (2-letter), zip, phone.
- "about" is a 1–3 sentence description of the business. "tagline" is a short slogan.
- Social/booking URLs must be full URLs copied from the text (else null).
- Do NOT extract treatments, prices, providers, staff, or reviews — ignore them.
- Call the record_clinic tool exactly once with your result.`;

export interface AiExtractInput {
  domain: string;
  pages: Array<{ url: string; text: string }>;
  /** Known values from G99, offered as hints (the AI may confirm or improve them). */
  hints?: {
    business_name?: string | null;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
  };
  model?: string;
}

const MAX_PAGE_CHARS = 8_000; // per page, to bound token cost

export interface AiExtractOutput {
  data: ExtractedClinic;
  model: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
}

export async function extractClinicDetails(
  input: AiExtractInput
): Promise<AiExtractOutput> {
  const pageBlocks = input.pages
    .map((p) => `### PAGE: ${p.url}\n${p.text.slice(0, MAX_PAGE_CHARS)}`)
    .join("\n\n");

  const hintLines = input.hints
    ? Object.entries(input.hints)
        .filter(([, v]) => v && String(v).trim())
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "";

  const user = [
    `Website domain: ${input.domain}`,
    hintLines ? `\nKnown values from our records (confirm/improve; ignore if the site disagrees):\n${hintLines}` : "",
    `\nPage text follows. Extract the clinic's basic details and ALL physical locations.\n`,
    pageBlocks,
  ].join("\n");

  const { data, model, usage } = await extractViaTool<unknown>({
    system: SYSTEM,
    user,
    toolName: "record_clinic",
    toolDescription:
      "Record the extracted basic clinic details and all physical locations.",
    inputSchema: TOOL_INPUT_SCHEMA,
    model: input.model,
    maxTokens: 3072,
  });

  // Zod validates + coerces; on a malformed result this throws (caller can escalate).
  const parsed = ExtractSchema.parse(data);
  return { data: parsed, model, usage };
}
