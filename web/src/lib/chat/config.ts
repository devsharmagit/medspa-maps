/**
 * config.ts — OpenRouter connection + chatbot guardrail settings.
 *
 * SERVER-SIDE ONLY. Never import this from a client component — it reads the
 * secret API key from the environment.
 */

export const OPENROUTER_BASE_URL =
  "https://openrouter.ai/api/v1/chat/completions";

/**
 * Primary model id (OpenRouter slug). Swappable via env.
 *
 * The assistant no longer uses tool/function-calling, so ANY instruct model
 * works — we pick strong, well-rate-limited free instruction-followers rather
 * than the narrow (and heavily throttled) tool-calling-capable slice.
 *
 * DEMO TIP: pin ONE pre-tested model here (set OPENROUTER_MODEL) so the demo
 * never silently swaps models mid-conversation. Leave the fallback chain below
 * as the resilient default for normal traffic.
 */
export const CHAT_MODEL =
  process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-oss-20b:free";

/**
 * Models tried in order. Free OpenRouter models get throttled (HTTP 429)
 * independently, so we fall back across several free instruct models. The
 * env-configured primary is tried first; duplicates removed. All slugs below
 * are verified-valid on the current account (invalid slugs 404 and waste a
 * fallback hop — re-verify with a probe before adding new ones).
 */
export const CHAT_MODELS: string[] = [
  ...new Set(
    [
      CHAT_MODEL,
      "openai/gpt-oss-20b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "openai/gpt-oss-120b:free",
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
  /** Sampling temperature — low for grounded, factual answers. */
  temperature: 0.3,
  /** Cap on tokens per model turn (headroom so the trailing MEMORY_UPDATE isn't truncated). */
  maxTokens: 900,
  /** Hard timeout on the single LLM call — on expiry we serve the templated fallback.
   *  Set generously: free models are slow (10–18s is normal), and a false abort of a
   *  good-but-slow answer is worse for a demo than a slightly longer wait. */
  llmTimeoutMs: 18_000,
  /** Independent timeout on backend data fetches (search); expiry → SEARCH_UNAVAILABLE. */
  fetchTimeoutMs: 6_000,
  /** Per-IP rate limit: max requests per window. */
  rateLimitMax: 20,
  /** Per-IP rate limit window, in milliseconds. */
  rateLimitWindowMs: 60_000,
} as const;
