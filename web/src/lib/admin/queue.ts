/**
 * admin/queue.ts — the unmatched-service review queue.
 *
 * Scraped clinic_services rows that don't resolve to a canonical service are
 * left with service_id NULL / match_status 'unmatched'. This module lets an
 * admin triage them: see the queue, map a raw name onto an existing canonical
 * service (optionally learning the alias), promote a brand-new canonical
 * service, or ignore obvious junk.
 *
 * Pure DB logic — no HTTP/auth — so it's unit-testable directly. Callers
 * (routes) handle auth via requireAdmin() and refresh clinic_search_view if
 * they need the public view updated.
 */

import { query, queryOne } from "@/lib/db";
import { slugify } from "@/lib/scraper/utils";
import {
  matchService,
  normalize,
  isLikelyNoise,
  type ServiceCategory,
} from "@/lib/taxonomy/canonical";

export interface UnmatchedSuggestion {
  slug: string;
  confidence: number;
}

export interface UnmatchedItem {
  raw_name: string;
  clinic_count: number;
  suggestion: UnmatchedSuggestion | null;
  is_noise: boolean;
}

/**
 * listUnmatched() — distinct raw_names still awaiting a canonical mapping
 * (match_status='unmatched' OR service_id IS NULL), excluding ones already
 * ignored. Each carries its clinic_count, a matchService() suggestion (or null),
 * and an is_noise flag. Sorted real-first (non-noise before noise), then by
 * clinic_count desc.
 */
export async function listUnmatched(): Promise<UnmatchedItem[]> {
  const rows = await query<{ raw_name: string; clinic_count: string }>(
    `SELECT raw_name, COUNT(DISTINCT clinic_id)::int AS clinic_count
       FROM clinic_services
      WHERE (match_status = 'unmatched' OR service_id IS NULL)
        AND COALESCE(match_status, '') <> 'ignored'
      GROUP BY raw_name`
  );

  const items: UnmatchedItem[] = rows.map((r) => {
    const m = matchService(r.raw_name);
    const suggestion: UnmatchedSuggestion | null = m.slug
      ? { slug: m.slug, confidence: m.confidence }
      : null;
    return {
      raw_name: r.raw_name,
      clinic_count: Number(r.clinic_count),
      suggestion,
      is_noise: isLikelyNoise(r.raw_name),
    };
  });

  // real-first, then by clinic_count desc, then alphabetical for stability
  items.sort((a, b) => {
    if (a.is_noise !== b.is_noise) return a.is_noise ? 1 : -1;
    if (a.clinic_count !== b.clinic_count) return b.clinic_count - a.clinic_count;
    return a.raw_name.localeCompare(b.raw_name);
  });

  return items;
}

export interface MapResult {
  raw_name: string;
  service_id: string;
  rows_updated: number;
  alias_added: boolean;
}

/**
 * mapUnmatched(rawName, serviceId, { addAlias }) — point every clinic_services
 * row with this raw_name at an existing canonical service and mark them
 * matched. When addAlias (default true), append the normalized rawName to that
 * service's aliases[] so future scrapes resolve automatically.
 */
export async function mapUnmatched(
  rawName: string,
  serviceId: string,
  opts: { addAlias?: boolean } = {}
): Promise<MapResult> {
  const addAlias = opts.addAlias ?? true;

  const svc = await queryOne<{ id: string }>(
    `SELECT id FROM services WHERE id = $1`,
    [serviceId]
  );
  if (!svc) throw new Error(`Service ${serviceId} not found`);

  const updated = await query<{ id: string }>(
    `UPDATE clinic_services
        SET service_id = $1,
            match_status = 'matched',
            match_confidence = 1,
            updated_at = NOW()
      WHERE raw_name = $2
        AND (match_status = 'unmatched' OR service_id IS NULL)
      RETURNING id`,
    [serviceId, rawName]
  );

  let aliasAdded = false;
  if (addAlias) {
    const norm = normalize(rawName);
    if (norm) {
      const res = await query<{ id: string }>(
        `UPDATE services
            SET aliases = array_append(COALESCE(aliases, '{}'), $2),
                updated_at = NOW()
          WHERE id = $1
            AND NOT ($2 = ANY(COALESCE(aliases, '{}')))
          RETURNING id`,
        [serviceId, norm]
      );
      aliasAdded = res.length > 0;
    }
  }

  return {
    raw_name: rawName,
    service_id: serviceId,
    rows_updated: updated.length,
    alias_added: aliasAdded,
  };
}

export interface PromoteFields {
  name: string;
  slug?: string;
  category?: ServiceCategory;
  summary?: string;
  description?: string;
}

export interface PromoteResult extends MapResult {
  created_service_id: string;
  slug: string;
}

/**
 * promoteUnmatched(rawName, fields) — create a NEW canonical service (pending
 * review, unpublished) from the supplied fields, then map every clinic_services
 * row with this raw_name onto it. Slug derives from fields.slug or fields.name.
 */
export async function promoteUnmatched(
  rawName: string,
  fields: PromoteFields
): Promise<PromoteResult> {
  const name = fields.name?.trim();
  if (!name) throw new Error("promoteUnmatched requires a name");
  const slug = slugify(fields.slug || name);
  if (!slug) throw new Error("Could not derive a slug from the supplied name");

  const inserted = await queryOne<{ id: string }>(
    `INSERT INTO services
       (name, slug, category, summary, description, aliases,
        is_published, review_status, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, false, 'pending', true)
     RETURNING id`,
    [
      name,
      slug,
      fields.category ?? null,
      fields.summary ?? null,
      fields.description ?? null,
      [normalize(rawName)].filter(Boolean),
    ]
  );
  if (!inserted) throw new Error("Failed to create canonical service");

  // map without re-adding the alias (already seeded above)
  const mapped = await mapUnmatched(rawName, inserted.id, { addAlias: false });

  return {
    ...mapped,
    created_service_id: inserted.id,
    slug,
  };
}

export interface IgnoreResult {
  raw_name: string;
  rows_updated: number;
}

/**
 * ignoreUnmatched(rawName) — mark every still-unmatched clinic_services row with
 * this raw_name as 'ignored'. Keeps the raw_name on the row but removes it from
 * the queue (and public surfaces, which only show matched services).
 */
export async function ignoreUnmatched(rawName: string): Promise<IgnoreResult> {
  const updated = await query<{ id: string }>(
    `UPDATE clinic_services
        SET match_status = 'ignored',
            updated_at = NOW()
      WHERE raw_name = $1
        AND (match_status = 'unmatched' OR service_id IS NULL)
      RETURNING id`,
    [rawName]
  );
  return { raw_name: rawName, rows_updated: updated.length };
}
