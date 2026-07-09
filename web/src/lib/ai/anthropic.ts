/**
 * ai/anthropic.ts — minimal Anthropic Messages API client (server-only).
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

/** Cheap default extraction model; override with INGEST_MODEL. */
export function ingestModel(): string {
  return process.env.INGEST_MODEL?.trim() || "claude-haiku-4-5";
}

/** Stronger model we escalate to when a cheap-model result fails validation. */
export const ESCALATION_MODEL = "claude-sonnet-5";

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
  // Optional provider override (e.g. INGEST_PROVIDER=gemini) routes the SAME
  // forced-tool contract through a different backend without touching callers.
  if (process.env.INGEST_PROVIDER?.trim().toLowerCase() === "gemini") {
    const { extractViaGemini } = await import("./gemini");
    return extractViaGemini<T>(opts);
  }

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = opts.model || ingestModel();

  // When images are supplied, send a content-block array: the prompt text, then
  // each image preceded by its label (URL + context) so the model can return the
  // chosen URL verbatim. Otherwise send `user` as a plain string (text-only).
  const content: string | ContentBlock[] = opts.images?.length
    ? [
        { type: "text", text: opts.user },
        ...opts.images.flatMap((img): ContentBlock[] => [
          { type: "text", text: img.label },
          { type: "image", source: img.source },
        ]),
      ]
    : opts.user;

  const body = JSON.stringify({
    model,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: opts.inputSchema,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [{ role: "user", content }],
  });

  // Retry 429 (rate limit) and 529 (overloaded) with backoff. Vision calls are
  // ~15K input tokens — over some orgs' per-minute token budget — so a bare call
  // would fail without honouring retry-after.
  const res = await postWithRetry(key, body);

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${errBody.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    stop_reason?: string;
    content?: Array<{ type: string; name?: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  if (json.stop_reason === "refusal") {
    throw new Error("Anthropic declined the request (refusal)");
  }

  const block = (json.content ?? []).find(
    (b) => b.type === "tool_use" && b.name === opts.toolName
  );
  if (!block || block.input === undefined) {
    throw new Error(
      `No tool_use block for "${opts.toolName}" (stop_reason=${json.stop_reason})`
    );
  }

  return { data: block.input as T, model, usage: json.usage ?? null };
}
