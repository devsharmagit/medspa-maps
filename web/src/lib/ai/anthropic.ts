/**
 * ai/anthropic.ts — the forced-tool extraction entry point for the whole ingest
 * pipeline.
 *
 * NAME IS HISTORICAL: this module no longer talks to Anthropic. `extractViaTool`
 * always delegates to `ai/openai.ts` (OpenAI is the only active ingest backend,
 * and a stale `INGEST_PROVIDER` in a local .env must not be able to reroute an
 * admin import). The Anthropic Messages-API client that used to live here was
 * unreachable and has been removed. Renaming the file touches every ingest
 * module, so it is deliberately left for its own change — see TASKS.md.
 *
 * Structured output is obtained with FORCED tool use: declare one tool whose
 * `input_schema` is the JSON Schema we want, force the model to call it, and read
 * the resulting arguments object back.
 *
 * NEVER import this into a client component — it carries the API key.
 */

import { extractViaOpenAI } from "@/lib/ai/openai";

/** Cheap default extraction model; override with OPENAI_MODEL. */
export function ingestModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

/** Stronger model we escalate to when a cheap-model result fails validation. */
export const ESCALATION_MODEL = process.env.OPENAI_ESCALATION_MODEL?.trim() || "gpt-4o";

export interface ToolExtractOptions {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  /** JSON Schema for the tool input (the shape we want back). */
  inputSchema: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
  /**
   * Optional determinism seed. Honoured by the OpenAI backend (passed as
   * `seed`); ignored by the Anthropic backend, which has no seed parameter.
   */
  seed?: number;
  /**
   * Optional images to show the model alongside `user`. A text `label` is placed
   * immediately before each image so the model can map the picture to its exact
   * URL and echo it back verbatim. Prefer base64 sources: URL sources count
   * against the low per-org "URL Content Fetching" rate limit (~10/min), which a
   * multi-image shortlist blows past. Callers should retry text-only on failure.
   */
  images?: Array<{ label: string; source: ImageSource }>;
}

export type ImageSource =
  | { type: "url"; url: string }
  | { type: "base64"; media_type: string; data: string };

/**
 * Stable per-domain seed for extraction calls.
 *
 * `temperature: 0` alone does NOT make OpenAI deterministic, and run-to-run
 * drift is not cosmetic here: it shows up directly in `clinic_catalog_changes`
 * as treatments and concerns that appear to have been added or removed when the
 * website never changed. Seeding by domain makes repeat runs on the same site
 * agree as far as the provider allows.
 */
export function domainSeed(domain: string): number {
  let h = 2166136261;
  for (let i = 0; i < domain.length; i++) {
    h ^= domain.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 2_147_483_647;
}

export interface ToolExtractResult<T> {
  data: T;
  model: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
}

/**
 * Run a forced-tool extraction and return the object the model produced.
 * Throws on HTTP error, refusal, or a missing tool call.
 */
export function extractViaTool<T>(opts: ToolExtractOptions): Promise<ToolExtractResult<T>> {
  return extractViaOpenAI<T>(opts);
}
