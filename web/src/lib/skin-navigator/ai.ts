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
  const [services, concerns] = await Promise.all([
    pool.query(
      `SELECT slug, name, summary, aliases
       FROM services
       WHERE is_active = true
         AND COALESCE(is_published, true) = true
         AND COALESCE(review_status, 'approved') = 'approved'
         AND name !~* '(dentistry|dental|orthodont|veneer)'
       ORDER BY
         CASE WHEN summary IS NULL THEN 1 ELSE 0 END,
         name
       LIMIT 120`
    ),
    pool.query(
      `SELECT slug, name, overview AS summary, aliases
       FROM concerns
       WHERE is_active = true
       ORDER BY
         CASE WHEN is_published = true THEN 0 ELSE 1 END,
         name
       LIMIT 120`
    ),
  ]);

  return {
    treatments: services.rows,
    concerns: concerns.rows,
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
