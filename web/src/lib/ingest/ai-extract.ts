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

const HourSchema = z.object({
  day: z.string(),
  open: z.string().nullable(),
  close: z.string().nullable(),
  is_open: z.boolean(),
});

const ProviderSchema = z.object({
  name: z.string(),
  title: z.string().nullable(),
  image_url: z.string().nullable(),
  card_tagline: z.string().nullable(),
  is_owner: z.boolean(),
});

const ServiceSchema = z.object({
  raw_name: z.string(), // service exactly as written on the site (keep ®/™, brand words)
  general_name: z.string().nullable(), // the general treatment name it maps to
  category: z.string().nullable(),
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
  cover_image_url: z.string().nullable(),
  logo_url: z.string().nullable(),
  gallery_image_urls: z.array(z.string()),
  working_hours: z.array(HourSchema),
  providers: z.array(ProviderSchema),
  services: z.array(ServiceSchema),
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
    cover_image_url: { type: ["string", "null"], description: "Best hero/cover image URL, copied verbatim from IMAGE CANDIDATES" },
    logo_url: { type: ["string", "null"], description: "Clinic logo URL, copied verbatim from IMAGE CANDIDATES" },
    gallery_image_urls: {
      type: "array",
      items: { type: "string" },
      description: "Real clinic/treatment photo URLs (≤10), verbatim from IMAGE CANDIDATES; exclude logo/cover/promos",
    },
    working_hours: {
      type: "array",
      description: "Opening hours parsed from page text; one entry per known day.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          day: { type: "string", description: "MONDAY..SUNDAY (uppercase)" },
          open: { type: ["string", "null"], description: "24-hour HH:MM, or null" },
          close: { type: ["string", "null"], description: "24-hour HH:MM, or null" },
          is_open: { type: "boolean" },
        },
        required: ["day", "open", "close", "is_open"],
      },
    },
    providers: {
      type: "array",
      description: "Every named provider/practitioner/staff member (team & about pages). [] if none.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Person's name, without trailing credentials" },
          title: {
            type: ["string", "null"],
            description: "Role/credentials label — prefer the medical designation, e.g. 'DNP, FNP-C', 'Aesthetic Injector', 'CEO, Medical Director, Founder'",
          },
          image_url: {
            type: ["string", "null"],
            description: "Headshot URL copied verbatim from PROVIDER IMAGE CANDIDATES, matched by name; null if none",
          },
          card_tagline: {
            type: ["string", "null"],
            description: "Short tagline for the OWNER/CEO/founder only; null otherwise",
          },
          is_owner: {
            type: "boolean",
            description: "true for the owner/CEO/founder/medical director (the boss); usually exactly one",
          },
        },
        required: ["name", "title", "image_url", "card_tagline", "is_owner"],
      },
    },
    services: {
      type: "array",
      description: "Every distinct service/treatment the clinic offers (from nav + services page). [] if none.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          raw_name: { type: "string", description: "The service EXACTLY as written on the site (keep ®/™ and brand words, e.g. 'Botox®', 'RUMA Gold Microchannel Treatment')" },
          general_name: {
            type: ["string", "null"],
            description: "The GENERAL treatment name this maps to. Prefer one of the KNOWN TREATMENTS listed in the prompt; if none fits, a concise generic name (no brand/®/™, no clinic-specific words). null only if it is not a real treatment.",
          },
          category: { type: ["string", "null"], description: "Group/category label if shown (e.g. 'Injectables', 'Skin Health')" },
        },
        required: ["raw_name", "general_name", "category"],
      },
    },
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
    "linkedin_url", "yelp_url", "cover_image_url", "logo_url",
    "gallery_image_urls", "working_hours", "providers", "services", "locations",
  ],
};

const SYSTEM = `You extract structured medspa/clinic information from website page text.

Rules:
- Use ONLY the provided page text. Do NOT invent or guess values.
- Return null for any field not present in the text.
- Return EVERY distinct physical location (address) you find — a business may have
  many. Give each location its own address, city, state (2-letter), zip, phone.
- "about" is a 1–3 sentence description of the business. "tagline" is a short slogan.
- Social URLs must be full URLs copied from the page text (else null).
- Do NOT extract prices or reviews — ignore them. (Providers and services ARE extracted — see their sections below.)

IMAGES — choose from the IMAGE CANDIDATES list (each line: [context] URL alt="..."). For the top candidates you are ALSO SHOWN THE ACTUAL IMAGE, each labeled with its URL. When an image is shown, judge it by WHAT YOU SEE (is it really a photo, a logo, or a promo graphic?), not just its filename or alt text:
- cover_image_url: the ONE best hero/cover photo representing the clinic — a real, large banner/slider/hero photo or a representative interior/treatment photo. NEVER a logo, wordmark, icon, text/banner graphic, or a promo/sponsor/newsletter/coupon/award graphic.
- logo_url: the clinic's actual logo or wordmark (usually context header or schema-logo, or a filename containing "logo"/"icon"); null if none.
- gallery_image_urls: up to 10 REAL clinic/treatment/interior/team photos. EXCLUDE the logo, the cover, icons, text/banner graphics, and any promo/sponsor/newsletter/coupon/award graphics.
- Copy image URLs VERBATIM from the candidate list. NEVER invent, guess, or alter a URL. Omit anything not in the list.

BOOKING — choose from the BOOKING LINK CANDIDATES list (each line: "label" → URL):
- booking_url: the online booking / scheduling link. Prefer an external scheduler (Vagaro, GlossGenius, Boulevard, Zenoti, Square, etc.); otherwise an on-page #book anchor. Copy the URL verbatim from the list, or null if none fits.

HOURS:
- working_hours: opening hours parsed from the page text. One entry per day you can determine, day = MONDAY..SUNDAY (uppercase), times in 24-hour "HH:MM". For closed days set is_open=false with open/close null. Omit days not stated; empty array if no hours appear.

PROVIDERS — from the team/about page text + the PROVIDER IMAGE CANDIDATES list:
- Extract EVERY provider/practitioner/staff person NAMED on the site (a clinic may have one or many; the owner may appear alone on an About page).
- name: the person's name only (no trailing credentials in this field).
- title: their role/credentials as shown — PREFER the medical-professional designation (e.g. "DNP, FNP-C", "Aesthetic Injector", "Nurse Practitioner", "CEO, Medical Director, Founder").
- image_url: their headshot — copy VERBATIM from PROVIDER IMAGE CANDIDATES, matched to the person (the filename often contains their name, e.g. SHELBY-HEADSHOT.webp → Shelby). null if no matching headshot.
- is_owner: true for the owner / CEO / founder / medical director (the boss). Usually exactly one; false for everyone else.
- card_tagline: a short tagline for the OWNER only (a founder/role emphasis or one-line descriptor from the site); null for all non-owners.
- Do NOT invent people, and do NOT list services/locations as providers. Empty array if none.

SERVICES — from the page text + the SERVICE CANDIDATES list (nav + services page):
- Extract EVERY distinct treatment/service the clinic OFFERS. Prefer the SERVICE CANDIDATES; add any clearly-offered service you see in the page text.
- raw_name: the service EXACTLY as written (KEEP ®/™ and brand words, e.g. "Botox®", "Morpheus8", "RUMA Gold Microchannel Treatment").
- general_name: the GENERAL treatment this maps to. If it reasonably fits one of the KNOWN TREATMENTS listed below, return that exact name. Otherwise propose a concise, GENERIC treatment name — no brand names, no ®/™, no clinic-specific words (e.g. "RUMA Gold Microchannel Treatment" → "Microneedling"; "Bioidentical Hormone Replacement" → "Hormone Therapy"). Two variants of the same treatment MUST get the SAME general_name.
- Set general_name = null ONLY when the item is not actually a treatment (a category header, a product line, or noise).
- category: the group/category label if the site shows one (e.g. "Injectables", "Skin Health"); else null.
- Do NOT list category headers, memberships, gift cards, financing, or consultations as services. Do NOT invent services. Empty array if none.

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
  /** Real image URLs on the page (the AI picks cover/logo/gallery from these). */
  imageCandidates?: Array<{ url: string; alt: string; context: string }>;
  /** Booking-ish links on the page (the AI picks the booking URL from these). */
  bookingCandidates?: Array<{ href: string; text: string }>;
  /** Images from team/about pages (the AI matches provider headshots from these). */
  providerImageCandidates?: Array<{ url: string; alt: string; context: string }>;
  /** Service/treatment names harvested from nav + services page (the AI maps these). */
  serviceCandidates?: Array<{ name: string; category?: string | null; url?: string | null }>;
  /** Current general-treatment names the AI should reuse before inventing new ones. */
  knownTreatments?: string[];
  model?: string;
  /**
   * Show the top image candidates to the model as actual images (Claude vision)
   * so cover/logo/gallery are picked by sight, not filename/alt. Default true
   * when imageCandidates exist; set false for the text-only escalation retry so
   * a hotlink-blocked/4xx image URL can't 400 the whole extraction.
   */
  useVision?: boolean;
}

const MAX_PAGE_CHARS = 8_000; // per page, to bound token cost

// Vision shortlist: how many candidate images we actually SHOW the model, and
// the context order we prioritise so the hero + logo + a few real photos survive
// the cap (~1.3–1.6K tokens/image, so we keep this small).
const VISION_IMAGE_CAP = 12;
const VISION_CONTEXT_PRIORITY = [
  "og-image", "schema-logo", "preload", "header", "hero",
  "background", "gallery", "footer", "body",
];

// Media types Claude vision accepts. SVG (common for logos) is NOT supported —
// those stay text-only candidates (matched by filename/context, not by sight).
const VISION_MEDIA_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
]);
const VISION_MAX_BYTES = 4_500_000; // stay under the API's ~5MB/image limit

function guessMediaType(url: string): string | null {
  const m = url.split(/[?#]/)[0].toLowerCase().match(/\.(jpe?g|png|gif|webp)$/);
  if (!m) return null;
  return m[1].startsWith("jp") ? "image/jpeg" : `image/${m[1]}`;
}

/** Fetch an image ourselves and base64-encode it (avoids the URL-fetch limit). */
async function fetchImageBase64(
  url: string
): Promise<{ media_type: string; data: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; medspa-map-ingest/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    let mt = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!VISION_MEDIA_TYPES.has(mt)) {
      const g = guessMediaType(url);
      if (!g) return null; // unsupported (e.g. svg) — skip, keep as text candidate
      mt = g;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.byteLength || buf.byteLength > VISION_MAX_BYTES) return null;
    return { media_type: mt, data: buf.toString("base64") };
  } catch {
    return null;
  }
}

type VisionImage = {
  label: string;
  source: { type: "base64"; media_type: string; data: string };
};

/** Rank candidates by context, take the top N, fetch + base64-encode each. */
async function buildVisionImages(
  candidates: Array<{ url: string; alt: string; context: string }>
): Promise<VisionImage[]> {
  const seen = new Set<string>();
  const prio = (ctx: string) => {
    const i = VISION_CONTEXT_PRIORITY.indexOf(ctx);
    return i === -1 ? VISION_CONTEXT_PRIORITY.length : i;
  };
  const shortlist = candidates
    .filter((c) => /^https?:\/\//i.test(c.url) && !seen.has(c.url) && seen.add(c.url))
    .map((c, i) => ({ c, i })) // keep original order as the stable tiebreak
    .sort((a, b) => prio(a.c.context) - prio(b.c.context) || a.i - b.i)
    .slice(0, VISION_IMAGE_CAP)
    .map(({ c }) => c);

  const fetched = await Promise.all(
    shortlist.map(async (c) => {
      const img = await fetchImageBase64(c.url);
      if (!img) return null;
      return {
        label: `IMAGE for ${c.url} — context: ${c.context}${c.alt ? `, alt: ${c.alt}` : ""}`,
        source: { type: "base64" as const, media_type: img.media_type, data: img.data },
      };
    })
  );
  return fetched.filter((x): x is VisionImage => x !== null);
}

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

  const imgBlock = input.imageCandidates?.length
    ? "\n\nIMAGE CANDIDATES (choose cover_image_url / logo_url / gallery_image_urls ONLY from these exact URLs):\n" +
      input.imageCandidates
        .map((c) => `- [${c.context}] ${c.url}${c.alt ? ` alt="${c.alt}"` : ""}`)
        .join("\n")
    : "";
  const bookBlock = input.bookingCandidates?.length
    ? "\n\nBOOKING LINK CANDIDATES (choose booking_url ONLY from these, or null):\n" +
      input.bookingCandidates.map((c) => `- "${c.text}" → ${c.href}`).join("\n")
    : "";
  const provBlock = input.providerImageCandidates?.length
    ? "\n\nPROVIDER IMAGE CANDIDATES (choose each provider's image_url ONLY from these exact URLs):\n" +
      input.providerImageCandidates
        .map((c) => `- ${c.url}${c.alt ? ` alt="${c.alt}"` : ""}`)
        .join("\n")
    : "";
  const svcBlock = input.serviceCandidates?.length
    ? "\n\nSERVICE CANDIDATES (services linked in nav / on the services page — extract these plus any others in the text):\n" +
      input.serviceCandidates
        .map((c) => `- ${c.name}${c.category ? ` [category: ${c.category}]` : ""}`)
        .join("\n")
    : "";
  const treatBlock = input.knownTreatments?.length
    ? "\n\nKNOWN TREATMENTS (map each service's general_name to one of these when it fits; otherwise propose a new generic name):\n" +
      input.knownTreatments.map((t) => `- ${t}`).join("\n")
    : "";

  const user = [
    `Website domain: ${input.domain}`,
    hintLines ? `\nKnown values from our records (confirm/improve; ignore if the site disagrees):\n${hintLines}` : "",
    `\nPage text follows. Extract the clinic's basic details, ALL physical locations, ALL providers, and ALL services.\n`,
    pageBlocks,
    imgBlock,
    bookBlock,
    provBlock,
    svcBlock,
    treatBlock,
  ].join("\n");

  const useVision =
    input.useVision !== false && (input.imageCandidates?.length ?? 0) > 0;
  const images = useVision
    ? await buildVisionImages(input.imageCandidates!)
    : undefined;

  const { data, model, usage } = await extractViaTool<unknown>({
    system: SYSTEM,
    user,
    toolName: "record_clinic",
    toolDescription:
      "Record the extracted basic clinic details, all physical locations, providers, and services.",
    inputSchema: TOOL_INPUT_SCHEMA,
    model: input.model,
    maxTokens: 8192,
    images,
  });

  // Zod validates + coerces; on a malformed result this throws (caller can escalate).
  const parsed = ExtractSchema.parse(data);
  return { data: parsed, model, usage };
}
