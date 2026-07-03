import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { listG99Businesses, type G99Business } from "@/lib/g99/source";
import { importedStatusFor, type ImportedInfo } from "@/lib/g99/imported";

export const dynamic = "force-dynamic";

export interface G99BusinessListItem extends G99Business {
  imported: Record<string, ImportedInfo>; // keyed by clinic_id
  importedCount: number;
  clinicCount: number;
}

// GET /api/admin/g99/businesses
// Lists every G99 business with website-bearing clinics, annotated with which
// clinics are already imported into our DB.
export async function GET() {
  try {
    await requireAdmin();

    const businesses = await listG99Businesses();

    // one cross-ref pass over every clinic across all businesses
    const allClinics = businesses.flatMap((b) =>
      b.clinics.map((c) => ({ clinic_id: c.clinic_id, website: c.website }))
    );
    const status = await importedStatusFor(allClinics);

    const items: G99BusinessListItem[] = businesses.map((b) => {
      const imported: Record<string, ImportedInfo> = {};
      let importedCount = 0;
      for (const c of b.clinics) {
        const info = status.get(c.clinic_id) ?? { state: "new", clinicId: null, slug: null };
        imported[c.clinic_id] = info;
        if (info.state === "imported") importedCount++;
      }
      return {
        ...b,
        imported,
        importedCount,
        clinicCount: b.clinics.length,
      };
    });

    return successResponse(items);
  } catch (err) {
    return handleApiError(err);
  }
}
