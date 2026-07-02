/**
 * config.ts — OpenRouter connection + chatbot guardrail settings.
 *
 * SERVER-SIDE ONLY. Never import this from a client component — it reads the
 * secret API key from the environment.
 */

export const OPENROUTER_BASE_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/** Primary model id (OpenRouter slug). Free + tool-calling capable; swappable via env. */
export const CHAT_MODEL =
  process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-oss-20b:free";

/**
 * Models tried in order. Free OpenRouter models get throttled (HTTP 429)
 * independently and often, so we fall back across several tool-calling-capable
 * free models. The env-configured primary is tried first; duplicates removed.
 * Set a single paid model in OPENROUTER_MODEL at launch to bypass all of this.
 */
export const CHAT_MODELS: string[] = [
  ...new Set(
    [
      CHAT_MODEL,
      "openai/gpt-oss-20b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "openai/gpt-oss-120b:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
    ].filter(Boolean)
  ),
];

/** Throws if the key is missing so the route can return a clean error. */
export function getOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return key;
}

export function openRouterHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getOpenRouterKey()}`,
    "Content-Type": "application/json",
    // Optional OpenRouter attribution headers
    "HTTP-Referer":
      process.env.OPENROUTER_SITE_URL?.trim() || "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_SITE_NAME?.trim() || "Medspa Map",
  };
}

/** Guardrails — keep a public, unauthenticated endpoint cheap and safe. */
export const CHAT_LIMITS = {
  /** Max messages of history accepted from the client per request. */
  maxMessages: 24,
  /** Max characters per message (server-enforced). */
  maxCharsPerMessage: 2000,
  /** Max tool-call rounds before we force a final text answer. */
  maxToolRounds: 4,
  /** Sampling temperature — low for grounded, factual answers. */
  temperature: 0.3,
  /** Cap on tokens per model turn. */
  maxTokens: 800,
  /** Per-IP rate limit: max requests per window. */
  rateLimitMax: 20,
  /** Per-IP rate limit window, in milliseconds. */
  rateLimitWindowMs: 60_000,
} as const;
