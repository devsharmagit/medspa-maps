// Provider domain types

/** Full provider row as stored in the DB (post-simplification). */
export interface Provider {
  id: string;
  clinic_id: string;
  name: string;
  title: string | null;
  /** Short one/two-line pitch shown on the provider card. */
  card_tagline: string | null;
  image_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Slim summary used in list/card views. */
export interface ProviderSummary {
  id: string;
  clinic_id: string;
  name: string;
  title: string | null;
  image_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

/** Payload to create or update a provider. */
export interface ProviderPayload {
  name: string;
  title?: string | null;
  card_tagline?: string | null;
  image_url?: string | null;
  is_verified?: boolean;
  /** IDs of canonical services (treatments) this provider performs. */
  service_ids?: string[];
  /** IDs of concerns this provider treats. */
  concern_ids?: string[];
}
