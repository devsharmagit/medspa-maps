import pool from "@/lib/db";
import { extractViaOpenAI } from "@/lib/ai/openai";
import {
  NavigatorAnalysisSchema,
  type NavigatorAnalysis,
  type NavigatorRequest,
} from "./schema";
import {
  buildNavigatorSystemPrompt,
  buildNavigatorUserPrompt,
  NAVIGATOR_TOOL_SCHEMA,
  type NavigatorPromptCatalog,
} from "./prompt";

export interface NavigatorPhotoInput {
  label: string;
  mediaType: string;
  base64: string;
}

export interface NavigatorAiResult {
  analysis: NavigatorAnalysis;
  model: string;
  usage: { input_tokens?: number; output_tokens?: number } | null;
}

async function loadPromptCatalog(): Promise<NavigatorPromptCatalog> {
  // The catalogs were simplified to bare (slug, name); summary/aliases/is_published
  // no longer exist. Select only what's there and fill the rest with null/[] — the
  // prompt builder already tolerates a missing summary and empty aliases.
  // Order by how many clinics actually offer each service/concern so the model
  // prefers CANONICAL, widely-carried options (botox, dermal-fillers, …) it can
  // match to real nearby clinics — not niche one-off slugs.
  const [services, concerns] = await Promise.all([
    pool.query<{ slug: string; name: string }>(
      `SELECT s.slug, s.name
       FROM services s
       WHERE s.is_active = true
         AND s.name !~* '(dentistry|dental|orthodont|veneer)'
       ORDER BY (SELECT count(*) FROM clinic_services cs
                 WHERE cs.service_id = s.id AND cs.is_active = true) DESC,
                s.name
       LIMIT 120`
    ),
    pool.query<{ slug: string; name: string }>(
      `SELECT co.slug, co.name
       FROM concerns co
       WHERE co.is_active = true
       ORDER BY (SELECT count(*) FROM clinic_concerns cc
                 WHERE cc.concern_id = co.id AND cc.is_active = true) DESC,
                co.name
       LIMIT 120`
    ),
  ]);

  const toItems = (rows: { slug: string; name: string }[]) =>
    rows.map((r) => ({ slug: r.slug, name: r.name, summary: null, aliases: [] }));

  return {
    treatments: toItems(services.rows),
    concerns: toItems(concerns.rows),
  };
}

export async function analyzeTreatmentNavigator(
  request: NavigatorRequest,
  photos: NavigatorPhotoInput[]
): Promise<NavigatorAiResult> {
  const catalog = await loadPromptCatalog();
  const hasPhotos = photos.length > 0;
  const result = await extractViaOpenAI<unknown>({
    system: buildNavigatorSystemPrompt(),
    user: buildNavigatorUserPrompt(request, catalog, hasPhotos),
    toolName: "create_treatment_navigation",
    toolDescription:
      "Create non-diagnostic cosmetic treatment recommendations and photo observations for the AI Treatment Navigator.",
    inputSchema: NAVIGATOR_TOOL_SCHEMA,
    maxTokens: 2400,
    images: photos.map((photo) => ({
      label: photo.label,
      source: {
        type: "base64",
        media_type: photo.mediaType,
        data: photo.base64,
      },
    })),
  });

  const parsed = NavigatorAnalysisSchema.parse(result.data);
  return {
    analysis: parsed,
    model: result.model,
    usage: result.usage,
  };
}
