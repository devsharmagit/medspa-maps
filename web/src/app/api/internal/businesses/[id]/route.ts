/**
 * PATCH /api/internal/businesses/[id]
 * Body: { phone?, instagram_url?, facebook_url? }
 *
 * Updates scraped fields for a non-G99 business.
 * Only writes non-null values — never overwrites existing data with null.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQuery } from "@/lib/sync/db-helpers";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const { id } = await params;
  const body = await req.json() as Record<string, string | null | undefined>;

  const allowed = ["phone", "instagram_url", "facebook_url"];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of allowed) {
    if (body[field] != null) {
      values.push(body[field]);
      updates.push(`${field} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    return Response.json({ ok: true, updated: false });
  }

  updates.push("updated_at = NOW()");
  values.push(id);

  await ourQuery(
    `UPDATE businesses SET ${updates.join(", ")} WHERE id = $${values.length}`,
    values
  );

  // Update linked clinics phone only if they currently have none
  if (body.phone) {
    await ourQuery(
      "UPDATE clinics SET phone = $1, updated_at = NOW() WHERE business_id = $2 AND phone IS NULL",
      [body.phone, id]
    );
  }

  return Response.json({ ok: true, updated: true });
}
