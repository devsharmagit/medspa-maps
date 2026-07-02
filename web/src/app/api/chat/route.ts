/**
 * /api/chat — chatbot endpoint.
 *
 * Holds the OpenRouter key server-side and runs a tool-calling agent loop
 * against our own data (see src/lib/chat/tools.ts). The model turns run
 * NON-streaming (free models emit tool calls reliably that way; in streaming
 * mode some providers leak the call into a "reasoning" channel and never
 * materialize it). The final answer is then streamed to the client token-by-
 * token for a live feel, as newline-delimited JSON (NDJSON) events:
 *   { "type": "token",  "value": "..." }   incremental answer text
 *   { "type": "status", "value": "..." }   transient status (e.g. searching)
 *   { "type": "error",  "value": "..." }   user-facing error
 *   { "type": "done" }                      end of stream
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  OPENROUTER_BASE_URL,
  CHAT_MODELS,
  openRouterHeaders,
  CHAT_LIMITS,
} from "@/lib/chat/config";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { TOOL_DEFS, executeTool } from "@/lib/chat/tools";
import { rateLimit } from "@/lib/chat/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(CHAT_LIMITS.maxCharsPerMessage),
      })
    )
    .min(1)
    .max(CHAT_LIMITS.maxMessages),
});

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
// Loose chat-message shape (OpenAI-compatible) — roles include tool/system.
type ChatMessage = Record<string, unknown>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return jsonError("Chat is not configured (missing API key).", 503);
  }

  // Per-IP rate limit — cheap abuse guard on a public, paid-API-backed endpoint.
  const rl = rateLimit(
    `chat:${getClientIp(req)}`,
    CHAT_LIMITS.rateLimitMax,
    CHAT_LIMITS.rateLimitWindowMs
  );
  if (!rl.ok) {
    return new Response(
      JSON.stringify({
        error: `You're sending messages too quickly. Please wait ${rl.retryAfter}s and try again.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfter),
        },
      }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return jsonError("Invalid request.", 400);

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    ...parsed.data.messages,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamedAny = false;
      const send = (obj: Record<string, unknown>) => {
        if (obj.type === "token") streamedAny = true;
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      try {
        for (let round = 0; round < CHAT_LIMITS.maxToolRounds; round++) {
          const isLast = round === CHAT_LIMITS.maxToolRounds - 1;
          const turn = await callModel(messages, !isLast);

          if (turn.error) {
            send({ type: "error", value: turn.error });
            break;
          }

          if (!isLast && turn.toolCalls.length > 0) {
            messages.push({
              role: "assistant",
              content: turn.content || "",
              tool_calls: turn.toolCalls,
            });
            send({ type: "status", value: "Searching Medspa Map…" });

            for (const tc of turn.toolCalls) {
              let args: Record<string, unknown> = {};
              try {
                args = tc.function.arguments
                  ? JSON.parse(tc.function.arguments)
                  : {};
              } catch {
                args = {};
              }
              let result: unknown;
              try {
                result = await executeTool(tc.function.name, args);
              } catch (err) {
                console.error("[chat] tool error:", tc.function.name, err);
                result = { error: "Tool failed." };
              }
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                name: tc.function.name,
                content: JSON.stringify(result),
              });
            }
            continue; // let the model use the tool results
          }

          // Final answer — stream it out token-by-token for a live feel.
          if (turn.content) await streamText(turn.content, send);
          break;
        }

        if (!streamedAny) {
          send({
            type: "token",
            value:
              "Sorry — I couldn't generate a response just now. Please try again, or tell me a treatment and your city and I'll find clinics for you.",
          });
        }
        send({ type: "done" });
      } catch (err) {
        console.error("[chat] stream error:", err);
        send({ type: "error", value: "Something went wrong. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * One non-streaming model turn, with model fallback. Free models flap in and
 * out of upstream rate limits and some providers return a reasoning-only,
 * empty turn — both are treated as soft failures that fall back to the next
 * candidate model. `require_parameters` keeps routing to providers that
 * actually support tool calling.
 */
async function callModel(
  messages: ChatMessage[],
  allowTools: boolean
): Promise<{ content: string; toolCalls: ToolCall[]; error?: string }> {
  let lastStatus = 503;

  for (const model of CHAT_MODELS) {
    let res: Response;
    try {
      res = await fetch(OPENROUTER_BASE_URL, {
        method: "POST",
        headers: openRouterHeaders(),
        body: JSON.stringify({
          model,
          messages,
          ...(allowTools
            ? {
                tools: TOOL_DEFS,
                tool_choice: "auto",
                provider: { require_parameters: true },
              }
            : {}),
          temperature: CHAT_LIMITS.temperature,
          max_tokens: CHAT_LIMITS.maxTokens,
          stream: false,
        }),
      });
    } catch (err) {
      console.error("[chat] fetch error:", model, err);
      continue; // network blip — try next model
    }

    if (!res.ok) {
      lastStatus = res.status;
      const body = await res.text().catch(() => "");
      console.error("[chat] error:", model, res.status, body.slice(0, 200));
      // Retryable (rate limit / upstream) → next model. Hard 4xx → stop.
      if (res.status !== 429 && res.status < 500) break;
      continue;
    }

    let json: {
      error?: unknown;
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    };
    try {
      json = await res.json();
    } catch {
      console.error("[chat] bad JSON from", model);
      continue;
    }

    if (json.error) {
      console.error("[chat] body error:", model, JSON.stringify(json.error).slice(0, 200));
      continue;
    }

    const msg = json.choices?.[0]?.message;
    const content = typeof msg?.content === "string" ? msg.content : "";
    const toolCalls: ToolCall[] = Array.isArray(msg?.tool_calls)
      ? msg!.tool_calls
          .filter((t) => t.function?.name)
          .map((t, i) => ({
            id: t.id || `call_${i}`,
            type: "function" as const,
            function: {
              name: t.function!.name!,
              arguments: t.function!.arguments || "",
            },
          }))
      : [];

    // Reasoning-only / empty turn → soft failure, try the next model.
    if (!content && toolCalls.length === 0) {
      console.error("[chat] empty turn from", model);
      continue;
    }

    return { content, toolCalls };
  }

  return { content: "", toolCalls: [], error: mapStatus(lastStatus) };
}

/** Simulated token streaming of a finished answer for a live typing feel. */
async function streamText(
  text: string,
  send: (obj: Record<string, unknown>) => void
) {
  const pieces = text.match(/\S+\s*/g) || [text];
  const delay = Math.max(3, Math.min(14, Math.floor(800 / Math.max(pieces.length, 1))));
  for (const p of pieces) {
    send({ type: "token", value: p });
    await sleep(delay);
  }
}

function mapStatus(status: number): string {
  if (status === 401 || status === 403)
    return "The AI service rejected the API key.";
  if (status === 402)
    return "The AI account is out of credits. Try a different model.";
  if (status === 429)
    return "The free models are busy right now (rate limit). Please try again in a moment.";
  return "The AI service is temporarily unavailable. Please try again.";
}
