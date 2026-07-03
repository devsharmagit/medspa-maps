import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";
import { scrapeClinicPreview } from "@/lib/admin/scrape-preview";
import { getG99Clinic } from "@/lib/g99/source";
import { overlayG99 } from "@/lib/g99/overlay";
import { query } from "@/lib/db";
import {
  websiteDomain,
  findExistingClinicsByDomain,
  type ExistingClinicRef,
} from "@/lib/admin/clinic-save";

export const dynamic = "force-dynamic";

const schema = z.object({
  g99ClinicId: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

/** Prepend https:// when the G99 website omits a protocol. */
function normalizeWebsite(site: string): string {
  const s = site.trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
}

// POST /api/admin/g99/import-preview  { g99ClinicId }
// Scrapes the G99 clinic's website into the SAME save-ready preview the
// "Add Clinic" flow uses, then OVERLAYS G99 metadata (address → city/state/zip,
// Google Maps / place id, logo, name) onto any gaps the scrape left. The result
// drops straight into the existing editable form; the g99 ids ride along so the
// save can stamp the link.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { g99ClinicId } = schema.parse(body);

    const found = await getG99Clinic(g99ClinicId);
    if (!found) throw ApiError.notFound("G99 clinic not found");
    const { business, clinic } = found;

    if (!clinic.website || !clinic.website.trim()) {
      throw ApiError.unprocessable("This G99 clinic has no website to import from.");
    }
    const website = normalizeWebsite(clinic.website);

    // Block if this clinic is already in our DB — either hard-linked by
    // g99_clinic_id (already imported) or sharing this website's domain (two
    // G99 clinics on one domain). No silent overwrite/merge — the admin edits
    // or deletes the existing clinic instead.
    const byDomain = websiteDomain(website);
    const [domainMatches, hardMatches] = await Promise.all([
      findExistingClinicsByDomain(byDomain),
      query<ExistingClinicRef>(
        `SELECT id, name, slug, website FROM clinics WHERE g99_clinic_id = $1::bigint`,
        [clinic.clinic_id]
      ),
    ]);
    const seen = new Set<string>();
    const existing = [...hardMatches, ...domainMatches].filter((c) =>
      seen.has(c.id) ? false : (seen.add(c.id), true)
    );
    if (existing.length > 0) {
      return successResponse({ blocked: true, duplicate: { byDomain, clinics: existing } });
    }

    let preview;
    try {
      preview = await scrapeClinicPreview(website);
    } catch {
      throw ApiError.unprocessable(
        "Could not scrape the clinic website. Check that the address is reachable."
      );
    }

    // ── overlay G99 metadata onto the scraped preview (fill gaps only) ────────
    const merged = overlayG99(preview, clinic, business.name);

    return successResponse({
      ...merged,
      g99: {
        clinicId: clinic.clinic_id,
        businessId: business.business_id,
        // tenant_id == business id in G99; kept explicit for the stamp
        tenantId: business.business_id,
        googlePlaceId: clinic.google_place_id ?? null,
      },
      g99Source: {
        businessName: business.name,
        clinicName: clinic.name,
        address: clinic.address,
        website: clinic.website,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
