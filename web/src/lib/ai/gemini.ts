/**
 * ai/gemini.ts — Gemini (Google Generative Language API) backend for the same
 * forced-tool extraction contract as ai/anthropic.ts's extractViaTool.
 *
 * Enabled by INGEST_PROVIDER=gemini. Lets the existing ingest pipeline run on a
 * Gemini key without touching ai-extract.ts / ingest-clinic.ts: extractViaTool
 * (in anthropic.ts) routes here when the env flag is set.
 *
 * Uses forced function calling (functionCallingConfig.mode=ANY) so we get the
 * same schema-shaped object back that Anthropic's forced tool_use gives.
 */

import type { ToolExtractOptions, ToolExtractResult } from "./anthropic";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

type GeminiSchema = Record<string, unknown>;

/**
 * Convert our JSON Schema (Anthropic/OpenAPI-ish, with `type: ["x","null"]`
 * unions and `additionalProperties`) into the OpenAPI subset Gemini's
 * functionDeclaration accepts: single `type` + `nullable`, no
 * `additionalProperties`.
 */
function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== "object") return node;

  const out: GeminiSchema = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === "additionalProperties") continue; // unsupported by Gemini
    if (k === "type" && Array.isArray(v)) {
      const nonNull = v.filter((t) => t !== "null");
      out.type = (nonNull[0] as string) ?? "string";
      if (v.includes("null")) out.nullable = true;
      continue;
    }
    if (k === "properties" && v && typeof v === "object") {
      out.properties = Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, toGeminiSchema(pv)])
      );
      continue;
    }
    if (k === "items") {
      out.items = toGeminiSchema(v);
      continue;
    }
    out[k] = v;
  }
  return out;
}

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function extractViaGemini<T>(
  opts: ToolExtractOptions
): Promise<ToolExtractResult<T>> {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = geminiModel();

  // Build the user turn: prompt text, then any base64 images (URL sources are
  // skipped — Gemini generateContent can't fetch arbitrary web URLs inline).
  const parts: Part[] = [{ text: opts.user }];
  for (const img of opts.images ?? []) {
    if (img.source.type === "base64") {
      parts.push({ text: img.label });
      parts.push({ inlineData: { mimeType: img.source.media_type, data: img.source.data } });
    }
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts }],
    tools: [
      {
        functionDeclarations: [
          {
            name: opts.toolName,
            description: opts.toolDescription,
            parameters: toGeminiSchema(opts.inputSchema),
          },
        ],
      },
    ],
    toolConfig: {
      functionCallingConfig: { mode: "ANY", allowedFunctionNames: [opts.toolName] },
    },
    generationConfig: {
      temperature: 0,
      maxOutputTokens: opts.maxTokens ?? 2048,
      // Disable "thinking" so the whole output budget goes to the function call
      // (thinking tokens otherwise eat into maxOutputTokens and truncate args).
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const url = `${API_BASE}/${model}:generateContent`;
  let res: Response | null = null;
  const MAX_RETRIES = 4;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok || ![429, 500, 503].includes(res.status) || attempt >= MAX_RETRIES) break;
    await res.body?.cancel().catch(() => {});
    await sleep(Math.min(2 ** attempt * 1000, 30_000));
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ functionCall?: { name?: string; args?: unknown } }> };
    }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const cand = json.candidates?.[0];
  const call = cand?.content?.parts?.find((p) => p.functionCall)?.functionCall;
  if (!call || call.args === undefined) {
    throw new Error(
      `Gemini returned no functionCall for "${opts.toolName}" (finishReason=${cand?.finishReason ?? "?"})`
    );
  }

  return {
    data: call.args as T,
    model,
    usage: {
      input_tokens: json.usageMetadata?.promptTokenCount,
      output_tokens: json.usageMetadata?.candidatesTokenCount,
    },
  };
}
