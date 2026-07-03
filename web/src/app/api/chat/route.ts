/**
 * /api/chat — non-tool-calling AI assistant endpoint.
 *
 * The model NEVER calls tools. Every turn is exactly ONE plain, non-streaming
 * chat-completion request whose prompt already contains every fact the model
 * needs. The flow is:
 *   1. deterministic intent extraction + routing (src/lib/chat/intent.ts)
 *   2. safety short-circuit (hardcoded reply, no LLM) OR backend data fetch
 *   3. build one system message + one labeled user message
 *   4. one model call (with a hard timeout + model fallback chain)
 *   5. parse the ANSWER/FOLLOWUPS/MEMORY_UPDATE marker contract
 *   6. fallback ladder → always a complete, real-data answer
 *   7. fake-stream the answer, then emit followups + updated memory
 *
 * Streams newline-delimited JSON (NDJSON) events to the client:
 *   { "type": "status",    "value": "..." }        transient status line
 *   { "type": "token",     "value": "..." }        incremental answer text
 *   { "type": "followups", "value": ["...", ...] } suggested next questions
 *   { "type": "memory",    "value": { summary, slots } } updated session memory
 *   { "type": "error",     "value": "..." }         user-facing error
 *   { "type": "done" }                               end of stream
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  OPENROUTER_BASE_URL,
  CHAT_MODELS,
  openRouterHeaders,
  CHAT_LIMITS,
} from "@/lib/chat/config";
import { buildSystemPrompt, safetyMessage } from "@/lib/chat/system-prompt";
import { rateLimit } from "@/lib/chat/rate-limit";
import {
  route as routeIntent,
  updateSlots,
  EMPTY_SLOTS,
  type PageContext,
  type PageType,
  type Slots,
} from "@/lib/chat/intent";
import {
  searchClinics,
  getClinicBySlug,
  getTreatmentInfo,
  getConcernInfo,
  type ClinicContext,
  type SearchResult,
  type TreatmentInfo,
  type ConcernInfo,
} from "@/lib/chat/data";
import { buildUserMessage, type GatheredContext } from "@/lib/chat/context";
import { parseReply, templatedAnswer, renderClinicList } from "@/lib/chat/format";
import { mergeFollowups } from "@/lib/chat/followups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_TYPES: PageType[] = [
  "home",
  "search",
  "treatment",
  "concern",
  "clinic",
  "provider",
  "other",
];

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
  page: z
    .object({
      type: z.enum(PAGE_TYPES as [PageType, ...PageType[]]).default("other"),
      slug: z.string().max(200).optional(),
    })
    .optional(),
  memory: z
    .object({
      summary: z.string().max(2000).optional(),
      slots: z
        .object({
          clinicInFocus: z.string().max(200).optional(),
          lastLocation: z.string().max(120).optional(),
          treatmentsDiscussed: z.array(z.string().max(80)).max(10).optional(),
        })
        .optional(),
    })
    .optional(),
});

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

  const clientMsgs = parsed.data.messages;
  const lastUser = [...clientMsgs].reverse().find((m) => m.role === "user");
  if (!lastUser) return jsonError("No user message.", 400);

  const page: PageContext = parsed.data.page ?? { type: "other" };
  const priorSlots: Slots = {
    ...EMPTY_SLOTS,
    ...(parsed.data.memory?.slots ?? {}),
    treatmentsDiscussed: parsed.data.memory?.slots?.treatmentsDiscussed ?? [],
  };
  const priorSummary = parsed.data.memory?.summary ?? "";

  // ── Deterministic intent + routing ───────────────────────────────────────
  const { route: r, extraction } = routeIntent(lastUser.content, page, priorSlots);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        // ── Priority 0: safety short-circuit — no LLM ────────────────────────
        if (r.path === "safety" && r.safetyKind) {
          const msg = safetyMessage(r.safetyKind);
          await streamText(msg, send);
          send({
            type: "followups",
            value: [
              "What treatments do you cover?",
              "Find medspas near me",
              "How does a consultation work?",
            ],
          });
          send({
            type: "memory",
            value: {
              summary: priorSummary,
              slots: priorSlots,
            },
          });
          send({ type: "done" });
          return;
        }

        // ── Backend data fetch (with timeouts) ───────────────────────────────
        send({ type: "status", value: statusLine(r, extraction.location) });

        const effectiveLocation = r.search?.location ?? "";
        const gathered = await gatherContext(r, page);

        // combined path: scope the search to the focused clinic's city/state.
        // (handled inside gatherContext)

        const newSlots = updateSlots(
          priorSlots,
          extraction,
          page,
          gathered.search?.filters.location ?? effectiveLocation
        );
        if (!newSlots.clinicInFocus && gathered.clinic) {
          newSlots.clinicInFocus = gathered.clinic.slug;
        }

        // ── Build the single prompt ──────────────────────────────────────────
        const recentTurns = clientMsgs
          .filter((m) => m.content.trim())
          .slice(0, -1) // exclude the current question (added as CURRENT_QUESTION)
          .slice(-6);
        const userMessage = buildUserMessage(lastUser.content, gathered, {
          summary: priorSummary,
          slots: newSlots,
          recentTurns,
        });
        const llmMessages = [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userMessage },
        ];

        // ── One model call ───────────────────────────────────────────────────
        const completion = await callModel(llmMessages);
        const parsedReply = completion ? parseReply(completion) : null;

        // ── Fallback ladder → final answer text ──────────────────────────────
        let answer: string;
        let modelFollowups: string[] = [];
        let memoryLine = "";

        if (parsedReply && parsedReply.structured && parsedReply.answer) {
          answer = parsedReply.answer;
          modelFollowups = parsedReply.followups;
          memoryLine = parsedReply.memory;
        } else if (parsedReply && parsedReply.answer) {
          // Markers missing but we got prose. If we have real data, append a
          // backend-rendered clinic list so the facts are never model-typed.
          answer = parsedReply.answer;
          if (
            gathered.search &&
            !gathered.search.unavailable &&
            gathered.search.count > 0 &&
            !/\]\(\/clinics\//.test(answer)
          ) {
            answer += `\n\n${renderClinicList(gathered.search)}`;
          }
        } else {
          // Total model failure → fully templated, real-data answer.
          answer = templatedAnswer(gathered);
        }

        answer = ensureDisclaimer(answer, r, gathered);

        // ── Stream the answer ────────────────────────────────────────────────
        await streamText(answer, send);

        // ── Follow-ups (always 3–5, grounded) ────────────────────────────────
        const followups = mergeFollowups(modelFollowups, r, gathered);
        send({ type: "followups", value: followups });

        // ── Updated memory ───────────────────────────────────────────────────
        // Accept the model's summary only if it looks complete; a MEMORY_UPDATE
        // truncated by max_tokens (no terminal punctuation) is discarded in
        // favor of the prior summary — memory degrades to "stale", never garbage.
        const cleanMemory = memoryLine.trim();
        const looksComplete = cleanMemory.length >= 15 && /[.!?]$/.test(cleanMemory);
        send({
          type: "memory",
          value: {
            summary: looksComplete ? cleanMemory : priorSummary,
            slots: newSlots,
          },
        });

        send({ type: "done" });
      } catch (err) {
        console.error("[chat] stream error:", err);
        send({ type: "error", value: "Something went wrong. Please try again." });
        send({ type: "done" });
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

// ──────────────────────────────────────────────────────────────────────────
// Data gathering per route path (each fetch guarded by a timeout)
// ──────────────────────────────────────────────────────────────────────────
async function gatherContext(
  r: ReturnType<typeof routeIntent>["route"],
  page: PageContext
): Promise<GatheredContext> {
  const g: GatheredContext = { page };

  // Clinic-in-focus (page_context, combined, or when a clinic page is open).
  const clinicSlug = r.clinicSlug;
  let clinic: ClinicContext | null = null;
  if (clinicSlug) {
    clinic = await withTimeout(getClinicBySlug(clinicSlug), null);
    g.clinic = clinic;
  }

  // Catalog facts (treatments + concerns).
  if (r.treatmentSlugs.length) {
    const infos: TreatmentInfo[] = r.treatmentSlugs
      .slice(0, 2)
      .map((slug) => getTreatmentInfo(slug))
      .filter((t) => t.found);
    if (infos.length) g.treatments = infos;
  }
  if (r.concernSlugs.length) {
    const infos: ConcernInfo[] = r.concernSlugs
      .slice(0, 2)
      .map((slug) => getConcernInfo(slug))
      .filter((c) => c.found);
    if (infos.length) g.concerns = infos;
  }

  // Search (search + combined paths).
  if (r.path === "search" || r.path === "combined") {
    const treatment = r.search?.treatment ?? "";
    let location = r.search?.location ?? "";
    // combined: scope to the focused clinic's city/state.
    if (r.path === "combined" && clinic) {
      if (!location) location = clinic.state ?? clinic.city ?? "";
    }
    const search: SearchResult = await withTimeout(
      searchClinics({ treatment, location, limit: 5 }),
      {
        count: 0,
        clinics: [],
        filters: { treatment: treatment || null, location: location || null },
        search_page: "/search",
        unavailable: true,
      } as SearchResult
    );
    g.search = search;
  }

  return g;
}

/** Resolve a promise, or a fallback value if it rejects or exceeds the timeout. */
async function withTimeout<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      p,
      new Promise<T>((resolve) =>
        setTimeout(() => resolve(fallback), CHAT_LIMITS.fetchTimeoutMs)
      ),
    ]);
  } catch (err) {
    console.error("[chat] fetch error:", err);
    return fallback;
  }
}

function statusLine(
  r: ReturnType<typeof routeIntent>["route"],
  location: string | null
): string {
  if (r.path === "search" || r.path === "combined") {
    const t = r.search?.treatment;
    const where = location ? ` near ${titleCase(location)}` : "";
    return t ? `Finding ${t} clinics${where}…` : "Searching Medspa Map…";
  }
  if (r.path === "catalog") return "Pulling up the details…";
  if (r.path === "page_context") return "Checking this page…";
  return "Thinking…";
}

function titleCase(s: string): string {
  return s.replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Append the general-info disclaimer when the answer discusses a treatment and lacks one. */
function ensureDisclaimer(
  answer: string,
  r: ReturnType<typeof routeIntent>["route"],
  g: GatheredContext
): string {
  const touchesTreatment =
    (g.treatments?.length ?? 0) > 0 ||
    r.treatmentSlugs.length > 0 ||
    (g.search?.filters.treatment ?? null) !== null;
  if (!touchesTreatment) return answer;
  if (/licensed provider|not medical advice|general information/i.test(answer))
    return answer;
  return `${answer}\n\n_General information only — a licensed provider can confirm what's right for you._`;
}

// ──────────────────────────────────────────────────────────────────────────
// One non-streaming model call, with model fallback + hard timeout.
// ──────────────────────────────────────────────────────────────────────────
async function callModel(
  messages: { role: string; content: string }[]
): Promise<string | null> {
  for (const model of CHAT_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHAT_LIMITS.llmTimeoutMs);
    try {
      const res = await fetch(OPENROUTER_BASE_URL, {
        method: "POST",
        headers: openRouterHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages,
          temperature: CHAT_LIMITS.temperature,
          max_tokens: CHAT_LIMITS.maxTokens,
          stream: false,
        }),
      });
      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[chat] model error:", model, res.status, body.slice(0, 160));
        if (res.status !== 429 && res.status < 500) break; // hard 4xx → stop
        continue; // rate-limited/upstream → next model
      }

      const json = (await res.json().catch(() => null)) as {
        error?: unknown;
        choices?: Array<{ message?: { content?: string | null } }>;
      } | null;
      if (!json || json.error) {
        console.error("[chat] bad body from", model);
        continue;
      }
      const content = json.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) return content;
      console.error("[chat] empty turn from", model);
    } catch (err) {
      clearTimeout(timer);
      console.error("[chat] fetch/abort:", model, (err as Error)?.name);
      continue; // timeout or network → next model
    }
  }
  return null; // all models failed → caller serves templated fallback
}

/** Simulated word-by-word streaming for a live typing feel. */
async function streamText(
  text: string,
  send: (obj: Record<string, unknown>) => void
) {
  const pieces = text.match(/\S+\s*/g) || [text];
  const delay = Math.max(
    3,
    Math.min(14, Math.floor(800 / Math.max(pieces.length, 1)))
  );
  for (const p of pieces) {
    send({ type: "token", value: p });
    await sleep(delay);
  }
}
