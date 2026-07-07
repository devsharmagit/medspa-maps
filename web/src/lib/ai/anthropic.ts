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
}

export interface ToolExtractResult<T> {
  data: T;
  model: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
}

/**
 * Call Claude and return the object it produced via a forced tool call.
 * Throws on HTTP error, refusal, or a missing tool_use block.
 */
export async function extractViaTool<T>(
  opts: ToolExtractOptions
): Promise<ToolExtractResult<T>> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = opts.model || ingestModel();

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
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
      messages: [{ role: "user", content: opts.user }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 400)}`);
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
