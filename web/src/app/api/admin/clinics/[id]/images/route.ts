import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query, queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";

const imageRefSchema = z.object({
  source_url: z.string().trim().min(1),
  alt_text: z.string().nullable().optional(),
});

const imagesSchema = z.object({
  logo: imageRefSchema.nullable().optional(),
  gallery: z.array(imageRefSchema).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ImageRow {
  id: string;
  source_url: string;
  cdn_url: string | null;
  role: string;
  sort_order: number;
  alt_text: string | null;
}

// PATCH /api/admin/clinics/[id]/images
// Replaces the editable clinic image set. Before/after images are left intact.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id: clinicId } = await params;

    const clinic = await queryOne<{ id: string; website: string | null }>(
      `SELECT id, website FROM clinics WHERE id = $1`,
      [clinicId]
    );
    if (!clinic) throw ApiError.notFound("Clinic not found");

    const body = await req.json();
    const data = imagesSchema.parse(body);

    let domain: string | null = null;
    try {
      domain = clinic.website ? new URL(clinic.website).hostname.replace(/^www\./, "") : null;
    } catch {
      domain = null;
    }

    await query(
      `DELETE FROM images
        WHERE entity_type = 'clinic'
          AND entity_id = $1
          AND role IN ('logo', 'cover', 'gallery')`,
      [clinicId]
    );

    const insertImage = async (
      image: z.infer<typeof imageRefSchema>,
      role: "logo" | "cover" | "gallery",
      sortOrder: number
    ) => {
      await query(
        `INSERT INTO images
           (entity_type, entity_id, source_url, role, sort_order, alt_text, scraped_domain, scrape_status)
         VALUES ('clinic', $1, $2, $3, $4, $5, $6, 'ok')
         ON CONFLICT (entity_type, entity_id, source_url) DO UPDATE SET
           role = EXCLUDED.role,
           sort_order = EXCLUDED.sort_order,
           alt_text = EXCLUDED.alt_text,
           scraped_domain = COALESCE(EXCLUDED.scraped_domain, images.scraped_domain),
           scrape_status = 'ok',
           updated_at = NOW()`,
        [clinicId, image.source_url, role, sortOrder, image.alt_text ?? null, domain]
      );
    };

    if (data.logo) {
      await insertImage(data.logo, "logo", 0);
    }

    for (const [idx, image] of (data.gallery ?? []).entries()) {
      await insertImage(image, idx === 0 ? "cover" : "gallery", idx);
    }

    const images = await query<ImageRow>(
      `SELECT id, source_url, cdn_url, role, sort_order, alt_text
         FROM images
        WHERE entity_type = 'clinic' AND entity_id = $1
        ORDER BY CASE role WHEN 'logo' THEN 0 WHEN 'cover' THEN 1 WHEN 'gallery' THEN 2 ELSE 3 END, sort_order`,
      [clinicId]
    );

    return successResponse(images);
  } catch (err) {
    return handleApiError(err);
  }
}
