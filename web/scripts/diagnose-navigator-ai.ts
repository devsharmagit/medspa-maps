/**
 * Diagnose the AI Treatment Navigator's upstream model call.
 *
 * The route hides the real failure behind "The AI service is temporarily
 * unavailable" (api/skin-navigator/analyze/route.ts:75). This makes the SAME
 * request — same base URL, key, model, forced tool call and strict schema —
 * and prints the raw upstream status + body.
 *
 * Run with the PROD env vars:
 *   AI_BASE_URL=... AI_API_KEY=... AI_MODEL=... bun scripts/diagnose-navigator-ai.ts
 */
import { NAVIGATOR_TOOL_SCHEMA } from "../src/lib/skin-navigator/prompt";

const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
const key = process.env.AI_API_KEY?.trim();
const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";

if (!key) {
  console.error("AI_API_KEY is not set");
  process.exit(1);
}

const thinking =
  ["true", "1", "yes"].includes(process.env.AI_DISABLE_THINKING?.trim().toLowerCase() ?? "")
    ? { chat_template_kwargs: { enable_thinking: false } }
    : {};

console.log(`POST ${baseUrl}/chat/completions`);
console.log(`model=${model}  key=${key.slice(0, 8)}…  thinkingExtras=${JSON.stringify(thinking)}`);

const body = {
  model,
  temperature: 0,
  ...thinking,
  seed: 7,
  max_completion_tokens: 2400,
  messages: [
    { role: "system", content: "You are a cosmetic treatment navigator." },
    { role: "user", content: "A 35-44 year old wants to look younger. Call the tool." },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "create_treatment_navigation",
        description: "Create non-diagnostic cosmetic treatment recommendations.",
        strict: true,
        parameters: NAVIGATOR_TOOL_SCHEMA,
      },
    },
  ],
  tool_choice: { type: "function", function: { name: "create_treatment_navigation" } },
};

const res = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(120_000),
});

const text = await res.text();
console.log(`\n--- HTTP ${res.status} ${res.statusText} ---`);
console.log(text.slice(0, 3000));

if (res.ok) {
  const json = JSON.parse(text);
  const msg = json.choices?.[0]?.message;
  console.log(`\nfinish_reason = ${json.choices?.[0]?.finish_reason}`);
  console.log(`refusal       = ${msg?.refusal ?? "none"}`);
  console.log(`tool_calls    = ${msg?.tool_calls?.length ?? 0}`);
  if (!msg?.tool_calls?.length) {
    console.log("\n>>> No tool call: this model ignores forced tool_choice → route throws\n    'OpenAI returned no tool call…' → the same frontend error.");
  }
}
