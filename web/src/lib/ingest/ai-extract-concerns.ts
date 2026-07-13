/**
 * ingest/ai-extract-concerns.ts — AI extraction of the patient CONCERNS a
 * clinic's website explicitly says it treats.
 *
 * Accuracy contract (the whole point of this module): a concern may be recorded
 * ONLY with on-page evidence — a verbatim quote naming the condition. The AI is
 * FORBIDDEN from inferring concerns from treatment names ("offers Botox" must
 * NOT yield "wrinkles"). Every returned quote is machine-verified downstream
 * (concern-validate.ts) against the exact page text supplied here; anything
 * that fails verification is discarded, so an inventing model gains nothing.
 */

import { z } from "zod";
import { extractViaTool } from "@/lib/ai/anthropic";

export const CONCERN_MAX_PAGE_CHARS = 16_000;

// ── Page condensing ──────────────────────────────────────────────────────────
// Concern evidence is short "we treat X" sentences; the rest of a page (nav,
// pricing, booking CTAs, bios) is noise that only bloats the request. Condensing
// each page to its condition-relevant sentences (plus neighbours for treatment
// context) shrinks a ~16K page to ~2-4K, so a whole clinic's pages fit in ONE
// AI call instead of several — the biggest lever on request count (the free
// tier's binding limit is requests/day, not tokens). Load-bearing detail: the
// SAME condensed text is fed to both the AI and concern-validate.ts, so quotes
// stay verifiable; and since the condensed text is a subset of the live page,
// an independent live-page audit still passes.
const CONDITION_VOCAB =
  /\b(acne|scars?|scarring|wrinkles?|fine lines?|expression lines?|frown lines?|forehead lines?|scowl lines?|11s|eleven lines?|bunny lines?|brow lift|crow'?s.?feet|lip flip|gummy smile|dimpled chin|chin dimpling|anti[\s-]?aging|age spots?|pigment\w*|hyperpigmentation|melasma|dark spots?|discolou?r\w*|uneven|texture|tone|rosacea|redness|flushing|sagg\w*|laxity|loose skin|jowls?|volume[\s-]?loss|hollow\w*|sun[\s-]?damage\w*|photodamage|cellulite|stretch marks?|pores?|dull\w*|dryness|dry skin|oily|blemish\w*|blackheads?|whiteheads?|breakouts?|double chin|submental|stubborn fat|fat reduction|contour\w*|hair (?:loss|thinning)|thinning hair|hyperhidrosis|sweat\w*|dark circles?|tired eyes|thin lips?|vaginal|incontinence|libido|intimacy|erectile|hormonal|hormone|fatigue|low energy|weight (?:loss|gain|fluctuat\w*)|menopaus\w*)\b/i;
// Sentences that INTRODUCE a treated-conditions list ("Helps address:") — kept
// so the list items that follow have their heading.
const LIST_INTRO_RE = /\b(helps? (?:with|address|treat)|treats?|addresses|targets?|ideal for|great for|designed to|improves?|reduces?|corrects?|what (?:it|we) treats?|concerns?(?: include| like| we treat)?)\b/i;

/** Reduce a page's plain text to condition-relevant sentences (+ one neighbour
 *  each side for treatment context), prefixed by a short lead for page context.
 *  Falls back to the raw lead when nothing matches (a page with no concerns
 *  contributes almost nothing, as it should). */
export function condenseForConcerns(text: string, maxChars = 5_000): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean; // already small — send as-is
  const sentences = clean.split(/(?<=[.!?:])\s+/);
  const keep = new Set<number>();
  for (let i = 0; i < sentences.length; i++) {
    if (CONDITION_VOCAB.test(sentences[i]) || LIST_INTRO_RE.test(sentences[i])) {
      keep.add(i - 1);
      keep.add(i);
      keep.add(i + 1);
    }
  }
  const lead = clean.slice(0, 300); // hero/title — tells the AI what page this is
  const picked: string[] = [];
  let prev = -2;
  for (let i = 0; i < sentences.length; i++) {
    if (!keep.has(i)) continue;
    picked.push((i !== prev + 1 && picked.length ? "… " : "") + sentences[i]);
    prev = i;
  }
  const body = picked.join(" ");
  const out = body ? `${lead} … ${body}` : lead;
  return out.length > maxChars ? out.slice(0, maxChars) : out;
}

// ── Validated output shape ────────────────────────────────────────────────────
const ConcernItemSchema = z.object({
  raw_phrase: z.string(),
  general_name: z.string(),
  paired_treatments: z.array(z.string()),
  source_url: z.string(),
  evidence_quote: z.string(),
});

const ConcernsSchema = z.object({
  concerns: z.array(ConcernItemSchema),
});

export type ExtractedConcern = z.infer<typeof ConcernItemSchema>;

const TOOL_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    concerns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          raw_phrase: {
            type: "string",
            description:
              'The concern EXACTLY as the page names it, e.g. "boxcar acne scars", "sagging jowls", "stubborn belly fat".',
          },
          general_name: {
            type: "string",
            description:
              'Public searchable concern name. Preserve the specific patient phrase the page names, e.g. "Forehead Lines", "Bunny Lines", "Crow\'s Feet", "Scowl Lines", "Acne Scars". Reuse a KNOWN CONCERN only when it is the SAME specific concern, not a broader bucket.',
          },
          paired_treatments: {
            type: "array",
            items: { type: "string" },
            description:
              'Treatment names THIS PAGE explicitly says address this concern (same sentence/section), e.g. ["Morpheus8"]. [] when the page names the concern without naming a treatment for it.',
          },
          source_url: {
            type: "string",
            description:
              "URL of the page (copied from a '### PAGE:' header) where the evidence quote appears.",
          },
          evidence_quote: {
            type: "string",
            description:
              "A short VERBATIM sentence or fragment (max ~200 chars) copied character-for-character from that page's text, in which the page says it treats/addresses this concern. It will be machine-verified against the page text; paraphrased or invented quotes are discarded.",
          },
        },
        required: ["raw_phrase", "general_name", "paired_treatments", "source_url", "evidence_quote"],
      },
    },
  },
  required: ["concerns"],
};

const SYSTEM = `You extract the patient CONCERNS / CONDITIONS a medical-spa website explicitly says it treats. You return data via the record_clinic_concerns tool only.

STRICT EVIDENCE RULES — violating any of these produces garbage:
1. Record a concern ONLY when the page text EXPLICITLY names the patient condition as something the clinic treats, addresses, targets, reduces, improves, corrects, or is ideal for — in a sentence, a "what it treats" bullet list, a condition-named page heading, or an FAQ answer.
2. NEVER infer a concern from a treatment name alone. A page that merely lists "Botox" or "Microneedling" with no condition language yields NOTHING from that page. Do not use your medical knowledge of what a treatment is usually for — only what THIS site's text says.
3. evidence_quote must be copied VERBATIM from the supplied page text (it is machine-verified; edited, paraphrased, or invented quotes are discarded). Keep it short — the one sentence/fragment that names the concern.
4. paired_treatments: include the treatment/service the SAME sentence, immediately-surrounding section, page title, or treatment page explicitly connects to the concern ("Morpheus8 targets sagging skin" → ["Morpheus8"]; a Botox treatment page section titled "What Botox Treats" → ["Botox"]). Never pair by outside medical knowledge.
5. Ignore: marketing adjectives with no named condition ("radiant", "glowing", "refreshed", "youthful look"), brand/product shop pages, location-SEO copy, staff bios. NEVER use patient testimonials or review quotes as evidence — only the clinic's own copy about what it treats.
6. Concerns are patient-searchable conditions/symptoms/treatment goals (forehead lines, scowl lines/11s, bunny lines, brow lift, crow's feet, lip flip, acne scars, hyperpigmentation, thin lips, unwanted hair, excess sweating, low energy…) — NOT treatments, NOT body areas alone ("face"), NOT wellness goals with no condition ("self-care"), NOT vague umbrella phrases ("skin challenges", "imperfections", "signs of aging" — record the SPECIFIC conditions the page names instead).
9. Ignore side effects, risks, warnings, contraindications, complications, recovery symptoms, or "may cause" language. A side effect is not a condition the clinic treats.
7. Emit each distinct concern once per page it is evidenced on (same concern on two pages → two entries with different source_url is fine and useful).
8. general_name must be SPECIFIC and patient-facing. Do NOT collapse "Forehead Lines", "Frown Lines", "Bunny Lines", "Crow's Feet", or "Scowl Lines" into "Wrinkles & Fine Lines". The website search needs those exact concern rows. Normalize casing/punctuation only; never include a treatment brand/device name unless the concern phrase itself is a brand-independent patient goal.
10. For treatment-area lists on treatment pages, emit each listed patient goal separately when the page context says the treatment addresses/treats those areas. Use the list item as raw_phrase/general_name and the nearest heading/list-intro as evidence_quote when needed.`;

export interface ConcernExtractInput {
  domain: string;
  pages: Array<{ url: string; text: string }>;
  /** live concern catalog (names + aliases) — reuse before inventing */
  knownConcerns: string[];
  /** the clinic's known treatment names, to help paired_treatments matching */
  knownTreatments: string[];
  model?: string;
}

export interface ConcernExtractOutput {
  concerns: ExtractedConcern[];
  model: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
}

export async function extractClinicConcerns(
  input: ConcernExtractInput
): Promise<ConcernExtractOutput> {
  const pageBlocks = input.pages
    .map((p) => `### PAGE: ${p.url}\n${p.text.slice(0, CONCERN_MAX_PAGE_CHARS)}`)
    .join("\n\n");

  const knownBlock = input.knownConcerns.length
    ? "\n\nKNOWN CONCERNS (reuse one only when it is the SAME specific concern; otherwise create the specific concern named by the page):\n" +
      input.knownConcerns.map((c) => `- ${c}`).join("\n")
    : "";
  const treatBlock = input.knownTreatments.length
    ? "\n\nTHIS CLINIC'S KNOWN TREATMENTS (helps you recognize treatment names for paired_treatments; NEVER a reason to record a concern):\n" +
      input.knownTreatments.map((t) => `- ${t}`).join("\n")
    : "";

  const user = [
    `Website domain: ${input.domain}`,
    `\nExtract every patient concern/condition this website EXPLICITLY says it treats, with a verbatim evidence quote per rule 3. If the text never names conditions, return an empty list — that is a correct answer.\n`,
    pageBlocks,
    knownBlock,
    treatBlock,
  ].join("\n");

  const { data, model, usage } = await extractViaTool<unknown>({
    system: SYSTEM,
    user,
    toolName: "record_clinic_concerns",
    toolDescription:
      "Record the patient concerns/conditions this website explicitly says it treats, each with a verbatim on-page evidence quote.",
    inputSchema: TOOL_INPUT_SCHEMA,
    model: input.model,
    maxTokens: 8192,
  });

  const parsed = ConcernsSchema.parse(data);
  return { concerns: parsed.concerns, model, usage };
}
