export interface HoursEntry {
  open: string | null;
  close: string | null;
  is_open: boolean;
}

export interface ScrapedService {
  name: string;
  slug: string;
  category?: string;         // parent nav menu label (e.g. "Injectables")
  scraped_from_url?: string; // absolute URL of the service detail page
  is_category?: boolean;     // true if this is a category/procedure page, not a leaf service
  description?: string;
  price_from?: number;
  price_to?: number;
  price_notes?: string;
  price_varies?: boolean;
  duration_minutes?: number;
}

export interface ScrapedProvider {
  name: string;
  title?: string;
  designation?: string;
  bio?: string;
  photo_url?: string;
  specializations?: string[];
}

export interface ScrapedImage {
  source_url: string;
  role: "cover" | "gallery" | "logo" | "before_after";
  alt_text?: string;
  sort_order?: number;
  match_score?: number;      // scoring for cover selection (higher = better match)
}

export interface ScrapeContact {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  about?: string;
  booking_url?: string;
  hours?: Record<string, HoursEntry>;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  youtube_url?: string;
  linkedin_url?: string;
  x_url?: string;
  yelp_url?: string;
  google_my_business?: string;
}

/** A single scraped location (for multi-location sites) */
export interface ScrapedLocation {
  name?: string;          // e.g. "Austin Location"
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  email?: string;
  hours?: Record<string, HoursEntry>;
  maps_url?: string;      // Google Maps link specific to this location
}

export interface ScrapeResult {
  url: string;
  scraped_at: string;
  pages_visited: string[];
  contact: ScrapeContact;
  /** One entry per detected physical location (≥1 always present) */
  locations: ScrapedLocation[];
  services: ScrapedService[];
  providers: ScrapedProvider[];
  images: ScrapedImage[];
}
