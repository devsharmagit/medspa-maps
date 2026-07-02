import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { websiteDomain, findExistingClinicsByDomain } from "@/lib/admin/clinic-save";

export const dynamic = "force-dynamic";

const schema = z.object({ website: z.string().min(1, "website is required") });

// POST /api/admin/clinics/check-duplicate  { website }
// Returns any existing clinics whose website resolves to the same domain. The
// add flows (manual URL, add-manually, G99 import) call this to BLOCK before
// creating a duplicate and point the admin at the existing clinic to edit/delete.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { website } = schema.parse(await req.json());
    const byDomain = websiteDomain(website);
    const clinics = await findExistingClinicsByDomain(byDomain);
    return successResponse({ exists: clinics.length > 0, byDomain, clinics });
  } catch (err) {
    return handleApiError(err);
  }
}
