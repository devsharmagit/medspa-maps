/**
 * ai/openai.ts — OpenAI backend for the same forced-tool extraction contract
 * used by the ingest pipeline.
 *
 * Enabled by INGEST_PROVIDER=openai. Uses Chat Completions tool calling with
 * strict structured outputs, so callers still receive one schema-shaped object
 * from the requested tool name.
 */

import type { ToolExtractOptions, ToolExtractResult } from "./anthropic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export function openaiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toOpenAiContent(opts: ToolExtractOptions): string | ContentPart[] {
  if (!opts.images?.length) return opts.user;

  const parts: ContentPart[] = [{ type: "text", text: opts.user }];
  for (const img of opts.images) {
    parts.push({ type: "text", text: img.label });
    if (img.source.type === "url") {
      parts.push({ type: "image_url", image_url: { url: img.source.url } });
    } else {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${img.source.media_type};base64,${img.source.data}`,
        },
      });
    }
  }
  return parts;
}

async function postWithRetry(key: string, body: string): Promise<Response> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(120_000),
    });
    if ((res.status !== 429 && res.status < 500) || attempt >= MAX_RETRIES) {
      return res;
    }

    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000 + 500, 65_000)
        : Math.min(2 ** attempt * 1000, 30_000);
    await res.body?.cancel().catch(() => {});
    await sleep(waitMs);
  }
}

export async function extractViaOpenAI<T>(
  opts: ToolExtractOptions
): Promise<ToolExtractResult<T>> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const model = opts.model || openaiModel();

  const body = JSON.stringify({
    model,
    temperature: 0,
    max_completion_tokens: opts.maxTokens ?? 2048,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: toOpenAiContent(opts) },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: opts.toolName,
          description: opts.toolDescription,
          strict: true,
          parameters: opts.inputSchema,
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: opts.toolName },
    },
  });

  const res = await postWithRetry(key, body);
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 600)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        refusal?: string | null;
        tool_calls?: Array<{
          type?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      finish_reason?: string;
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const choice = json.choices?.[0];
  if (choice?.message?.refusal) {
    throw new Error(`OpenAI declined the request: ${choice.message.refusal}`);
  }

  const call = choice?.message?.tool_calls?.find(
    (tc) => tc.type === "function" && tc.function?.name === opts.toolName
  );
  const args = call?.function?.arguments;
  if (!args) {
    throw new Error(
      `OpenAI returned no tool call for "${opts.toolName}" (finish_reason=${choice?.finish_reason ?? "?"})`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(args);
  } catch (err) {
    throw new Error(
      `OpenAI returned invalid JSON for "${opts.toolName}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  return {
    data: parsed as T,
    model,
    usage: {
      input_tokens: json.usage?.prompt_tokens,
      output_tokens: json.usage?.completion_tokens,
    },
  };
}
