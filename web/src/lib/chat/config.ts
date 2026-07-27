/**
 * config.ts — OpenAI connection + chatbot guardrail settings.
 *
 * SERVER-SIDE ONLY. Never import this from a client component — it reads the
 * secret API key from the environment.
 */

export const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Chat model id. Swappable via env, independently of the ingest pipeline's
 * OPENAI_MODEL so the two can be tuned separately (the chatbot is
 * latency-sensitive; ingest is accuracy-sensitive).
 */
export const CHAT_MODEL =
  process.env.OPENAI_CHAT_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  "gpt-4o-mini";

/** Throws if the key is missing so the route can return a clean error. */
export function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}

export function openAiHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getOpenAIKey()}`,
    "Content-Type": "application/json",
  };
}

/** Guardrails — keep a public, unauthenticated endpoint cheap and safe. */
export const CHAT_LIMITS = {
  /** Max messages of history accepted from the client per request. */
  maxMessages: 24,
  /** Max characters per message (server-enforced). */
  maxCharsPerMessage: 2000,
  /** Sampling temperature — low for grounded, factual answers. */
  temperature: 0.3,
  /** Cap on tokens per model turn (headroom so the trailing MEMORY_UPDATE isn't truncated). */
  maxTokens: 900,
  /** Hard timeout on the single LLM call — on expiry we serve the templated fallback.
   *  12s is generous for gpt-4o-mini at this prompt size (typically 2–4s); the old
   *  18s was sized for slow free-tier models and only delayed the fallback. */
  llmTimeoutMs: 12_000,
  /** Independent timeout on backend data fetches (search); expiry → SEARCH_UNAVAILABLE. */
  fetchTimeoutMs: 6_000,
  /** Per-IP rate limit: max requests per window. */
  rateLimitMax: 20,
  /** Per-IP rate limit window, in milliseconds. */
  rateLimitWindowMs: 60_000,
} as const;
