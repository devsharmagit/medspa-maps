/**
 * ai/anthropic.ts — forced-tool extraction router plus legacy Anthropic client.
 *
 * Uses the paid ANTHROPIC_API_KEY (a real `sk-ant-…` Claude key) directly against
 * https://api.anthropic.com/v1/messages via fetch (no SDK dependency).
 *
 * Structured output is obtained with FORCED tool use: we declare one tool whose
 * `input_schema` is the JSON Schema we want, force `tool_choice` to it, and read
 * the resulting `tool_use.input` object. This is the most reliable way to get a
 * schema-shaped object back and works on Haiku 4.5 (our default extraction model).
 *
 * NEVER import this into a client component — it carries the API key.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** Cheap default extraction model; override with OPENAI_MODEL. */
export function ingestModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

/** Stronger model we escalate to when a cheap-model result fails validation. */
export const ESCALATION_MODEL = process.env.OPENAI_ESCALATION_MODEL?.trim() || "gpt-4o";

export interface ToolExtractOptions {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  /** JSON Schema for the tool input (the shape we want back). */
  inputSchema: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
  /**
   * Optional images to show the model alongside `user`. A text `label` is placed
   * immediately before each image so the model can map the picture to its exact
   * URL and echo it back verbatim. Prefer base64 sources: URL sources count
   * against the low per-org "URL Content Fetching" rate limit (~10/min), which a
   * multi-image shortlist blows past. Callers should retry text-only on failure.
   */
  images?: Array<{ label: string; source: ImageSource }>;
}

type ImageSource =
  | { type: "url"; url: string }
  | { type: "base64"; media_type: string; data: string };

/** A single content block sent in the user message. */
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: ImageSource };

export interface ToolExtractResult<T> {
  data: T;
  model: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST to the Messages API, retrying on 429/529 with backoff. Honours the
 * `retry-after` header (seconds) when present, otherwise exponential backoff
 * capped at 60s. Non-retryable statuses (and the final attempt) return as-is.
 */
async function postWithRetry(key: string, body: string): Promise<Response> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(120_000),
    });
    if ((res.status !== 429 && res.status !== 529) || attempt >= MAX_RETRIES) {
      return res;
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000 + 500, 65_000)
        : Math.min(2 ** attempt * 1000, 60_000);
    await res.body?.cancel().catch(() => {});
    await sleep(waitMs);
  }
}

/**
 * Call Claude and return the object it produced via a forced tool call.
 * Throws on HTTP error, refusal, or a missing tool_use block.
 */
export async function extractViaTool<T>(
  opts: ToolExtractOptions
): Promise<ToolExtractResult<T>> {
  // OpenAI is the only active ingest backend. Ignore stale INGEST_PROVIDER
  // values from local .env files so admin imports never fall into Gemini or
  // Anthropic by accident.
  const { extractViaOpenAI } = await import("./openai");
  return extractViaOpenAI<T>(opts);
}
