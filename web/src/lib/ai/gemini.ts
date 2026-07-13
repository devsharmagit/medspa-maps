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

  const buildBody = (temperature: number): string =>
    JSON.stringify({
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
        temperature,
        maxOutputTokens: opts.maxTokens ?? 2048,
        // Disable "thinking" so the whole output budget goes to the function call
        // (thinking tokens otherwise eat into maxOutputTokens and truncate args).
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

  const url = `${API_BASE}/${model}:generateContent`;
  const MAX_RETRIES = 4;
  // Flash occasionally emits an unparseable call (finishReason=MALFORMED_FUNCTION_CALL).
  // At temperature 0 an identical retry reproduces the identical failure, so
  // malformed retries bump the temperature to escape it.
  const MAX_MALFORMED_RETRIES = 2;
  let malformed = 0;
  let lastFinish: string | undefined;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: buildBody(malformed === 0 ? 0 : 0.4),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      // Fail FAST on a per-DAY free-tier exhaustion: retrying just burns the
      // (already spent) daily request budget and wall-clock — the window won't
      // reset within our backoff. Per-MINUTE throttles DO recover, so retry
      // those. Distinguish by the quota id / message in the 429 body.
      const isPerDay = res.status === 429 && /perday|per day|_per_day|requestsperday/i.test(errBody);
      if ([429, 500, 503].includes(res.status) && attempt < MAX_RETRIES && !isPerDay) {
        // Honor Gemini's OWN retry hint ("retryDelay":"41s" / "retry in 41.6s") —
        // free-tier per-minute windows are ~40s+, longer than plain exponential
        // backoff, so a fixed 15s ladder exhausts retries before the window
        // resets. Sleep the hinted delay (+buffer), capped; else exponential.
        const hint = errBody.match(/retry(?:delay)?["\s:]+(?:in\s+)?(\d+(?:\.\d+)?)\s*s/i);
        const hintMs = hint ? Math.ceil(parseFloat(hint[1]) * 1000) + 1500 : 0;
        const backoff = Math.min(2 ** attempt * 1000, 30_000);
        await sleep(Math.min(Math.max(hintMs, backoff), 65_000));
        continue;
      }
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
      lastFinish = cand?.finishReason;
      if (lastFinish === "MALFORMED_FUNCTION_CALL" && malformed < MAX_MALFORMED_RETRIES) {
        malformed++;
        await sleep(1000);
        continue;
      }
      throw new Error(
        `Gemini returned no functionCall for "${opts.toolName}" (finishReason=${lastFinish ?? "?"})`
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
}
