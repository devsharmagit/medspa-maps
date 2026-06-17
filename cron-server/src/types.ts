// ── G99 types (shapes returned by /api/internal/g99/businesses) ───────────────

export interface G99Clinic {
  clinic_id: number;
  clinic_name: string;
  clinic_address: string | null;
  clinic_city: string | null;
  clinic_state: string | null;
  clinic_country: string | null;
  clinic_contact_number: string | null;
  clinic_website: string | null;
  clinic_about: string | null;
  google_my_business: string | null;
  google_place_id: string | null;
  google_profile_id: string | null;
}

export interface G99Business {
  business_id: number;
  business_name: string;
  logo_url: string | null;
  about: string | null;
  clinics: G99Clinic[];
}

// ── Internal API responses ────────────────────────────────────────────────────

export interface UpsertBusinessResponse {
  our_business_id: string;
}

export interface UpsertClinicResponse {
  our_clinic_id: string;
}

export interface ManualClinic {
  id: string;
  business_id: string;
  website: string;
}

// ── Scrape API response (from /api/scrape) ────────────────────────────────────

export interface ScrapeServiceRow {
  raw_name: string;
  slug: string;
  category?: string;
  is_category?: boolean;
  description?: string;
  price_from?: number;
  scraped_from_url: string;
}

export interface ScrapeImageRow {
  entity_type: "clinic" | "business";
  source_url: string;
  role: "cover" | "gallery" | "logo";
  alt_text?: string;
  sort_order: number;
  match_score?: number;
  scraped_domain: string;
  scrape_status: "pending";
}

export interface ScrapeClinicResult {
  services: ScrapeServiceRow[];
  images: ScrapeImageRow[];
}

export interface ScrapeApiResponse {
  scraped_at: string;
  source_url: string;
  business: { name: string; logo_url?: string; business_images: ScrapeImageRow[] };
  clinics: ScrapeClinicResult[];
}
