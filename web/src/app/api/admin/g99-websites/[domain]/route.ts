import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { queryOne } from "@/lib/db";
import {
  getProdClinicsByIds,
  getProdBusiness,
  type ProdG99Clinic,
  type ProdG99Business,
} from "@/lib/g99/prod";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ domain: string }>;
}

interface WebsiteRow {
  domain: string;
  website: string;
  g99_clinic_ids: string[];
  g99_business_ids: string[];
  business_name: string | null;
  clinic_name: string | null;
  specialization: string | null;
}

export interface G99LiveDetail {
  domain: string;
  source: "live" | "snapshot";
  note?: string;
  specialization: string | null;
  business: ProdG99Business | null;
  clinics: ProdG99Clinic[];
}

function stubClinic(id: string, businessId: string | null, name: string | null, website: string): ProdG99Clinic {
  return {
    clinic_id: id,
    tenant_id: businessId,
    name,
    website,
    address: null,
    city: null,
    state: null,
    country: null,
    contact_number: null,
    about: null,
    google_my_business: null,
    google_place_id: null,
    google_profile_id: null,
    instagram: null,
    facebook: null,
    twitter: null,
    tiktok: null,
    yelp_url: null,
    appointment_url: null,
    clinic_url: null,
    services: [],
  };
}

// GET /api/admin/g99-websites/:domain — the clinic's LIVE record(s) from G99 prod.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { domain } = await params;
    const dom = decodeURIComponent(domain).toLowerCase().replace(/^www\./, "");

    const row = await queryOne<WebsiteRow>(
      `SELECT domain, website, g99_clinic_ids, g99_business_ids,
              business_name, clinic_name, specialization
         FROM g99_clinic_websites WHERE domain = $1`,
      [dom]
    );

    if (!row) {
      const detail: G99LiveDetail = {
        domain: dom,
        source: "live",
        specialization: null,
        business: null,
        clinics: [],
        note: "No harvested record for this website.",
      };
      return successResponse(detail);
    }

    const clinicIds = row.g99_clinic_ids ?? [];
    const businessId = row.g99_business_ids?.[0] ?? null;

    // Try LIVE prod first.
    try {
      const clinics = await getProdClinicsByIds(clinicIds);
      if (clinics.length > 0) {
        const business = await getProdBusiness(businessId).catch(() => null);
        const detail: G99LiveDetail = {
          domain: dom,
          source: "live",
          specialization: row.specialization,
          business,
          clinics,
        };
        return successResponse(detail);
      }
    } catch {
      // fall through to snapshot
    }

    // Snapshot fallback — only the website→id mapping is stored locally.
    const detail: G99LiveDetail = {
      domain: dom,
      source: "snapshot",
      specialization: row.specialization,
      note:
        "G99 prod is unreachable (is scripts/g99/prod_tunnel.py running?). Only the harvested website→clinic-id mapping is available offline.",
      business: row.business_name
        ? {
            business_id: businessId ?? "",
            name: row.business_name,
            website: row.website,
            logo_url: null,
            about: null,
            city: null,
            state: null,
            country: null,
            phone: null,
          }
        : null,
      clinics: clinicIds.map((id, i) =>
        stubClinic(id, businessId, i === 0 ? row.clinic_name : null, row.website)
      ),
    };
    return successResponse(detail);
  } catch (err) {
    return handleApiError(err);
  }
}
