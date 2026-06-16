export interface HoursEntry {
  open: string | null;
  close: string | null;
  is_open: boolean;
}

export interface ScrapedService {
  name: string;
  slug: string;
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
  role: "cover" | "gallery" | "logo";
  alt_text?: string;
  sort_order?: number;
}

export interface ScrapeContact {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  about?: string;
  booking_url?: string;
  hours?: Record<string, HoursEntry>;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  yelp_url?: string;
  google_my_business?: string;
}

export interface ScrapeResult {
  url: string;
  scraped_at: string;
  pages_visited: string[];
  contact: ScrapeContact;
  services: ScrapedService[];
  providers: ScrapedProvider[];
  images: ScrapedImage[];
}
