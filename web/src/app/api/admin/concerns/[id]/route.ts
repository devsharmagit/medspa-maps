import { NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";

const patchSchema = z
  .object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(255),
    overview: z.string().nullable(),
    details: z.record(z.string(), z.unknown()).nullable(),
    faqs: z.array(z.unknown()).nullable(),
    aliases: z.array(z.string()).nullable(),
    is_published: z.boolean(),
    is_active: z.boolean(),
    service_ids: z.array(z.string().uuid()),
  })
  .partial();

interface Concern {
  id: string;
  name: string;
  slug: string;
  overview: string | null;
  details: Record<string, unknown> | null;
  faqs: unknown[] | null;
  aliases: string[] | null;
  is_published: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CONCERN_COLUMNS = `id, name, slug, overview, details, faqs, aliases,
  is_published, is_active, created_at, updated_at`;

// JSONB columns must be passed as JSON strings to the pg driver.
const JSON_COLUMNS = new Set(["details", "faqs"]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function loadConcern(id: string): Promise<(Concern & { service_ids: string[] }) | null> {
  return queryOne<Concern & { service_ids: string[] }>(
    `SELECT ${CONCERN_COLUMNS},
            COALESCE(
              (SELECT array_agg(cs.service_id ORDER BY cs.display_order)
               FROM concern_services cs WHERE cs.concern_id = c.id),
              '{}'
            ) AS service_ids
     FROM concerns c WHERE c.id = $1`,
    [id]
  );
}

// GET /api/admin/concerns/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const concern = await loadConcern(id);
    if (!concern) throw ApiError.notFound("Concern not found");

    return successResponse(concern);
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/admin/concerns/[id] — update editorial fields + service links
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const { service_ids, ...updates } = patchSchema.parse(body);

    const keys = Object.keys(updates) as (keyof typeof updates)[];

    if (keys.length === 0 && service_ids === undefined) {
      throw ApiError.badRequest("No fields to update");
    }

    if (keys.length > 0) {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      keys.forEach((key) => {
        const raw = updates[key];
        values.push(JSON_COLUMNS.has(key) && raw !== null ? JSON.stringify(raw) : raw);
        setClauses.push(`${key} = $${values.length}`);
      });
      setClauses.push("updated_at = now()");
      values.push(id);

      const updated = await queryOne<{ id: string }>(
        `UPDATE concerns SET ${setClauses.join(", ")}
         WHERE id = $${values.length}
         RETURNING id`,
        values
      );
      if (!updated) throw ApiError.notFound("Concern not found");
    } else {
      const exists = await queryOne<{ id: string }>(
        "SELECT id FROM concerns WHERE id = $1",
        [id]
      );
      if (!exists) throw ApiError.notFound("Concern not found");
    }

    // Replace concern_services links when service_ids provided.
    if (service_ids !== undefined) {
      await query("DELETE FROM concern_services WHERE concern_id = $1", [id]);
      if (service_ids.length > 0) {
        await query(
          `INSERT INTO concern_services (concern_id, service_id, display_order)
           SELECT $1, sid, ord - 1
           FROM unnest($2::uuid[]) WITH ORDINALITY AS t(sid, ord)
           ON CONFLICT DO NOTHING`,
          [id, service_ids]
        );
      }
    }

    const concern = await loadConcern(id);
    return successResponse(concern);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return handleApiError(ApiError.conflict("A concern with that slug already exists"));
    }
    return handleApiError(err);
  }
}

// DELETE /api/admin/concerns/[id] — soft delete (is_active = false)
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;

    const rows = await query<{ id: string; name: string }>(
      `UPDATE concerns SET is_active = false, updated_at = now()
       WHERE id = $1
       RETURNING id, name`,
      [id]
    );

    if (rows.length === 0) throw ApiError.notFound("Concern not found");

    return successResponse({ id: rows[0].id, name: rows[0].name });
  } catch (err) {
    return handleApiError(err);
  }
}
