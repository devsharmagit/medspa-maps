// Provider domain types

export interface ProviderCredential {
  title: string;
  institution: string;
}

export interface ProviderSpecialty {
  title: string;
  description: string;
}

/** Full provider row as stored in the DB. */
export interface Provider {
  id: string;
  clinic_id: string;
  name: string;
  title: string | null;
  bio: string | null;
  image_url: string | null;
  years_experience: number | null;
  is_verified: boolean;
  /** Array of short highlight strings, e.g. ["Board Certified", "10+ Years Exp"] */
  highlights: string[];
  /** Credentials list, e.g. [{title: "MSN", institution: "University of Utah"}] */
  credentials: ProviderCredential[];
  /** Specialties list, e.g. [{title: "Injectables", description: "…"}] */
  specialties: ProviderSpecialty[];
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
  years_experience: number | null;
  is_active: boolean;
  created_at: string;
}

/** Payload to create or update a provider. */
export interface ProviderPayload {
  name: string;
  title?: string | null;
  bio?: string | null;
  image_url?: string | null;
  years_experience?: number | null;
  is_verified?: boolean;
  highlights?: string[];
  credentials?: ProviderCredential[];
  specialties?: ProviderSpecialty[];
  /** IDs of canonical services (treatments) this provider performs. */
  service_ids?: string[];
  /** IDs of concerns this provider treats. */
  concern_ids?: string[];
}
