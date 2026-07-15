--
--


-- Dumped from database version 18.4 (eaf151e)
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.refresh_clinic_rating() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE target UUID;
      BEGIN
        target := COALESCE(NEW.clinic_id, OLD.clinic_id);
        IF target IS NULL THEN RETURN NULL; END IF;
        UPDATE clinics c SET
          avg_rating = sub.avg_rating,
          review_count = sub.cnt
        FROM (
          SELECT
            ROUND(AVG(rating)::numeric, 2) AS avg_rating,
            COUNT(*) AS cnt
          FROM reviews
          WHERE clinic_id = target AND is_approved = true AND is_active = true
            AND rating IS NOT NULL
        ) sub
        WHERE c.id = target;
        RETURN NULL;
      END;
      $$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$;

CREATE OR REPLACE FUNCTION public.slugify(val text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        public.unaccent(trim(val)),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '[\s-]+', '-', 'g'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_medspa_leads_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;


-- TABLES
CREATE TABLE IF NOT EXISTS public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.businesses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    tier text DEFAULT 'free'::text NOT NULL,
    tier_expires_at timestamp with time zone,
    verified boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    data_source text DEFAULT 'manual'::text NOT NULL,
    g99_business_id bigint,
    g99_tenant_id bigint,
    last_synced_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clinic_concerns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    concern_id uuid NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clinic_locations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    label text,
    address text,
    city text,
    state text,
    zip text,
    country text DEFAULT 'US'::text NOT NULL,
    lat numeric(10,7),
    lng numeric(10,7),
    geo public.geography(Point,4326),
    phone text,
    email text,
    booking_url text,
    google_maps_url text,
    google_place_id text,
    hours jsonb,
    is_primary boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clinic_services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    service_id uuid,
    raw_name text NOT NULL,
    description text,
    data_source text DEFAULT 'scraped'::text NOT NULL,
    scraped_from_url text,
    last_scraped_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    price_from numeric,
    price_unit text,
    match_status text DEFAULT 'unmatched'::text,
    match_confidence numeric
);

CREATE TABLE IF NOT EXISTS public.clinic_service_concerns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    service_id uuid NOT NULL,
    concern_id uuid NOT NULL,
    source text DEFAULT 'scraped'::text NOT NULL,
    raw_service_name text,
    raw_concern_name text,
    source_url text,
    is_active boolean DEFAULT true NOT NULL,
    extracted_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clinics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    website text NOT NULL,
    booking_url text,
    address text,
    city text,
    state text,
    zip text,
    country text DEFAULT 'US'::text,
    geo public.geography(Point,4326),
    lat numeric(10,7),
    lng numeric(10,7),
    phone text,
    email text,
    about text,
    instagram_url text,
    facebook_url text,
    tiktok_url text,
    youtube_url text,
    x_url text,
    linkedin_url text,
    yelp_url text,
    google_my_business text,
    google_place_id text,
    hours jsonb,
    tier text DEFAULT 'free'::text NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    avg_rating numeric(3,2),
    review_count integer DEFAULT 0 NOT NULL,
    data_source text DEFAULT 'manual'::text NOT NULL,
    g99_clinic_id bigint,
    last_synced_at timestamp with time zone,
    last_scraped_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ext_rating numeric(3,2),
    ext_review_count integer,
    tagline text,
    founded_year integer,
    google_maps_url text,
    stat_experts text,
    stat_cities text,
    stat_treatments text,
    stat_rating text,
    stat_patients text
);

CREATE TABLE IF NOT EXISTS public.images (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    source_url text NOT NULL,
    cdn_url text,
    storage_key text,
    role text DEFAULT 'gallery'::text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    alt_text text,
    scraped_domain text,
    scrape_status text DEFAULT 'pending'::text NOT NULL,
    last_checked_at timestamp with time zone,
    g99_image_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    category text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    summary text,
    description text,
    price_from numeric,
    price_unit text,
    treatment_time text,
    results_timeline text,
    results_duration text,
    recovery_time text,
    aliases text[],
    hero_rating numeric(3,2),
    hero_review_count integer,
    is_published boolean DEFAULT true,
    review_status text DEFAULT 'approved'::text,
    faqs jsonb DEFAULT '[]'::jsonb,
    origin text DEFAULT 'seed'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.clinic_service_changes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    service_id uuid,
    service_slug text NOT NULL,
    service_name text NOT NULL,
    change_type text NOT NULL,
    raw_name text,
    match_confidence numeric,
    scrape_job_id uuid,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clinic_service_changes_change_type_check CHECK ((change_type = ANY (ARRAY['added'::text, 'removed'::text])))
);

CREATE TABLE IF NOT EXISTS public.concern_services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    concern_id uuid NOT NULL,
    service_id uuid NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.concerns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    overview text,
    details jsonb,
    faqs jsonb,
    meta_title text,
    meta_description text,
    schema_markup jsonb,
    data_source text DEFAULT 'scraped'::text NOT NULL,
    source_url text,
    is_published boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    aliases text[]
);

CREATE TABLE IF NOT EXISTS public.listing_claims (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    contact_name text NOT NULL,
    contact_email text NOT NULL,
    contact_phone text,
    spa_name text,
    status text DEFAULT 'pending'::text NOT NULL,
    verification_token text,
    verified_at timestamp with time zone,
    approved_at timestamp with time zone,
    rejected_at timestamp with time zone,
    rejection_reason text,
    source_page text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.medspa_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    business_email text NOT NULL,
    business_name text NOT NULL,
    phone text,
    message text,
    status text DEFAULT 'new'::text,
    notes text,
    source text DEFAULT 'website'::text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contacted_at timestamp with time zone,
    is_active boolean DEFAULT true,
    CONSTRAINT medspa_leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'converted'::text, 'rejected'::text])))
);

CREATE TABLE IF NOT EXISTS public.provider_concerns (
    provider_id uuid NOT NULL,
    concern_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.provider_services (
    provider_id uuid NOT NULL,
    service_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    name text NOT NULL,
    title text,
    bio text,
    image_url text,
    years_experience integer,
    is_verified boolean DEFAULT false NOT NULL,
    highlights jsonb DEFAULT '[]'::jsonb NOT NULL,
    credentials jsonb DEFAULT '[]'::jsonb NOT NULL,
    specialties jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    card_tagline text,
    review_rating numeric(2,1),
    review_count integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid,
    provider_id uuid,
    service_id uuid,
    concern_id uuid,
    rating smallint,
    body text,
    reviewer_name text,
    source text DEFAULT 'scraped'::text NOT NULL,
    source_url text,
    content_hash text,
    is_approved boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    g99_review_id bigint,
    data_source text DEFAULT 'scraped'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

CREATE TABLE IF NOT EXISTS public.scrape_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    target_url text NOT NULL,
    job_type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    error_message text,
    services_found integer DEFAULT 0,
    images_found integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- COLUMN BACKFILL (upgrades any pre-existing partial tables)
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS tier text DEFAULT 'free'::text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS tier_expires_at timestamp with time zone;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual'::text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS g99_business_id bigint;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS g99_tenant_id bigint;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinic_concerns ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.clinic_concerns ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.clinic_concerns ADD COLUMN IF NOT EXISTS concern_id uuid;
ALTER TABLE public.clinic_concerns ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'::text;
ALTER TABLE public.clinic_concerns ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.clinic_concerns ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinic_concerns ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS zip text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS country text DEFAULT 'US'::text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS lat numeric(10,7);
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS lng numeric(10,7);
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS geo geography(Point,4326);
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS booking_url text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS google_maps_url text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS hours jsonb;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinic_locations ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS service_id uuid;
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS service_slug text;
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS service_name text;
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS change_type text;
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS raw_name text;
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS match_confidence numeric;
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS scrape_job_id uuid;
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS detected_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinic_service_changes ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS service_id uuid;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS raw_name text;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'scraped'::text;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS scraped_from_url text;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS last_scraped_at timestamp with time zone;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS price_from numeric;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS price_unit text;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS match_status text DEFAULT 'unmatched'::text;
ALTER TABLE public.clinic_services ADD COLUMN IF NOT EXISTS match_confidence numeric;
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS service_id uuid;
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS concern_id uuid;
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS source text DEFAULT 'scraped'::text;
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS raw_service_name text;
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS raw_concern_name text;
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS extracted_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinic_service_concerns ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS business_id uuid;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS booking_url text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS zip text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS country text DEFAULT 'US'::text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS geo geography(Point,4326);
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS lat numeric(10,7);
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS lng numeric(10,7);
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS about text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS tiktok_url text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS x_url text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS yelp_url text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS google_my_business text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS hours jsonb;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS tier text DEFAULT 'free'::text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2);
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual'::text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS g99_clinic_id bigint;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS last_scraped_at timestamp with time zone;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS ext_rating numeric(3,2);
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS ext_review_count integer;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS founded_year integer;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS google_maps_url text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS stat_experts text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS stat_cities text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS stat_treatments text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS stat_rating text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS stat_patients text;
ALTER TABLE public.concern_services ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.concern_services ADD COLUMN IF NOT EXISTS concern_id uuid;
ALTER TABLE public.concern_services ADD COLUMN IF NOT EXISTS service_id uuid;
ALTER TABLE public.concern_services ADD COLUMN IF NOT EXISTS display_order smallint DEFAULT 0;
ALTER TABLE public.concern_services ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS overview text;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS faqs jsonb;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS schema_markup jsonb;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'scraped'::text;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.concerns ADD COLUMN IF NOT EXISTS aliases text[];
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS cdn_url text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS storage_key text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS role text DEFAULT 'gallery'::text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS sort_order smallint DEFAULT 0;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS alt_text text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS scraped_domain text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS scrape_status text DEFAULT 'pending'::text;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS last_checked_at timestamp with time zone;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS g99_image_id bigint;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS business_id uuid;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS spa_name text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS verification_token text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS source_page text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.listing_claims ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS business_email text;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS status text DEFAULT 'new'::text;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS source text DEFAULT 'website'::text;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS contacted_at timestamp with time zone;
ALTER TABLE public.medspa_leads ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.provider_concerns ADD COLUMN IF NOT EXISTS provider_id uuid;
ALTER TABLE public.provider_concerns ADD COLUMN IF NOT EXISTS concern_id uuid;
ALTER TABLE public.provider_services ADD COLUMN IF NOT EXISTS provider_id uuid;
ALTER TABLE public.provider_services ADD COLUMN IF NOT EXISTS service_id uuid;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS years_experience integer;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS highlights jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS credentials jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS specialties jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS card_tagline text;
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS review_rating numeric(2,1);
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS provider_id uuid;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS service_id uuid;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS concern_id uuid;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating smallint;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_name text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS source text DEFAULT 'scraped'::text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT true;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS g99_review_id bigint;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'scraped'::text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS target_url text;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS job_type text;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS finished_at timestamp with time zone;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS services_found integer DEFAULT 0;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS images_found integer DEFAULT 0;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price_from numeric;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price_unit text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS treatment_time text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS results_timeline text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS results_duration text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS recovery_time text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS aliases text[];
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS hero_rating numeric(3,2);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS hero_review_count integer;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'approved'::text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS faqs jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS origin text DEFAULT 'seed'::text NOT NULL;


-- PRIMARY KEY / UNIQUE / CHECK CONSTRAINTS
DO $$ BEGIN
ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_g99_business_id_key UNIQUE (g99_business_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_g99_tenant_id_key UNIQUE (g99_tenant_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_concerns
    ADD CONSTRAINT clinic_concerns_clinic_id_concern_id_key UNIQUE (clinic_id, concern_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_concerns
    ADD CONSTRAINT clinic_concerns_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_service_concerns
    ADD CONSTRAINT clinic_service_concerns_clinic_service_concern_source_key UNIQUE (clinic_id, service_id, concern_id, source);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_service_concerns
    ADD CONSTRAINT clinic_service_concerns_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_locations
    ADD CONSTRAINT clinic_locations_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_service_changes
    ADD CONSTRAINT clinic_service_changes_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_clinic_id_raw_name_key UNIQUE (clinic_id, raw_name);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_business_id_slug_key UNIQUE (business_id, slug);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_g99_clinic_id_key UNIQUE (g99_clinic_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.concern_services
    ADD CONSTRAINT concern_services_concern_id_service_id_key UNIQUE (concern_id, service_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.concern_services
    ADD CONSTRAINT concern_services_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.concerns
    ADD CONSTRAINT concerns_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.concerns
    ADD CONSTRAINT concerns_slug_key UNIQUE (slug);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_entity_type_entity_id_source_url_key UNIQUE (entity_type, entity_id, source_url);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.listing_claims
    ADD CONSTRAINT listing_claims_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.listing_claims
    ADD CONSTRAINT listing_claims_verification_token_key UNIQUE (verification_token);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.medspa_leads
    ADD CONSTRAINT medspa_leads_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.provider_concerns
    ADD CONSTRAINT provider_concerns_pkey PRIMARY KEY (provider_id, concern_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.provider_services
    ADD CONSTRAINT provider_services_pkey PRIMARY KEY (provider_id, service_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_content_hash_key UNIQUE (content_hash);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_g99_review_id_key UNIQUE (g99_review_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.scrape_jobs
    ADD CONSTRAINT scrape_jobs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_slug_key UNIQUE (slug);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;


-- FOREIGN KEY CONSTRAINTS
DO $$ BEGIN
ALTER TABLE ONLY public.clinic_concerns
    ADD CONSTRAINT clinic_concerns_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_concerns
    ADD CONSTRAINT clinic_concerns_concern_id_fkey FOREIGN KEY (concern_id) REFERENCES public.concerns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_service_concerns
    ADD CONSTRAINT clinic_service_concerns_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_service_concerns
    ADD CONSTRAINT clinic_service_concerns_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_service_concerns
    ADD CONSTRAINT clinic_service_concerns_concern_id_fkey FOREIGN KEY (concern_id) REFERENCES public.concerns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_locations
    ADD CONSTRAINT clinic_locations_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_service_changes
    ADD CONSTRAINT clinic_service_changes_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_service_changes
    ADD CONSTRAINT clinic_service_changes_scrape_job_id_fkey FOREIGN KEY (scrape_job_id) REFERENCES public.scrape_jobs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_service_changes
    ADD CONSTRAINT clinic_service_changes_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.concern_services
    ADD CONSTRAINT concern_services_concern_id_fkey FOREIGN KEY (concern_id) REFERENCES public.concerns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.concern_services
    ADD CONSTRAINT concern_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.listing_claims
    ADD CONSTRAINT listing_claims_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.provider_concerns
    ADD CONSTRAINT provider_concerns_concern_id_fkey FOREIGN KEY (concern_id) REFERENCES public.concerns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.provider_concerns
    ADD CONSTRAINT provider_concerns_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.provider_services
    ADD CONSTRAINT provider_services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.provider_services
    ADD CONSTRAINT provider_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_concern_id_fkey FOREIGN KEY (concern_id) REFERENCES public.concerns(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE ONLY public.scrape_jobs
    ADD CONSTRAINT scrape_jobs_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
--
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;


-- MATERIALIZED VIEW
DROP MATERIALIZED VIEW IF EXISTS public.clinic_search_view CASCADE;
CREATE MATERIALIZED VIEW public.clinic_search_view AS
 SELECT c.id AS clinic_id,
    c.business_id,
    c.name AS clinic_name,
    c.slug AS clinic_slug,
    b.name AS business_name,
    c.address,
    c.city,
    c.state,
    c.zip,
    c.country,
    c.lat,
    c.lng,
    c.geo,
    c.phone,
    c.website,
    c.booking_url,
    c.about,
    c.instagram_url,
    c.facebook_url,
    c.google_place_id,
    c.yelp_url,
    c.hours,
    c.tier,
    c.verified,
    c.featured,
    c.avg_rating,
    c.review_count,
    COALESCE(array_agg(DISTINCT COALESCE(sv.name, cs.raw_name)) FILTER (WHERE (cs.is_active = true)), '{}'::text[]) AS service_names,
    COALESCE(array_agg(DISTINCT COALESCE(sv.slug, public.slugify(cs.raw_name))) FILTER (WHERE (cs.is_active = true)), '{}'::text[]) AS service_slugs,
    ( SELECT i.source_url
           FROM public.images i
          WHERE ((i.entity_type = 'clinic'::text) AND (i.entity_id = c.id) AND (i.role = 'cover'::text) AND (i.scrape_status = 'ok'::text))
          ORDER BY i.sort_order
         LIMIT 1) AS cover_image_url,
    ( SELECT i.source_url
           FROM public.images i
          WHERE ((i.entity_type = 'business'::text) AND (i.entity_id = c.business_id) AND (i.role = 'logo'::text) AND (i.scrape_status = 'ok'::text))
          ORDER BY i.sort_order
         LIMIT 1) AS logo_url
   FROM (((public.clinics c
     JOIN public.businesses b ON ((b.id = c.business_id)))
     LEFT JOIN public.clinic_services cs ON ((cs.clinic_id = c.id)))
     LEFT JOIN public.services sv ON ((sv.id = cs.service_id)))
  WHERE ((c.is_active = true) AND (b.is_active = true))
  GROUP BY c.id, c.business_id, c.name, c.slug, b.name, c.address, c.city, c.state, c.zip, c.country, c.lat, c.lng, c.geo, c.phone, c.website, c.booking_url, c.about, c.instagram_url, c.facebook_url, c.google_place_id, c.yelp_url, c.hours, c.tier, c.verified, c.featured, c.avg_rating, c.review_count
  WITH NO DATA;


-- INDEXES
CREATE INDEX IF NOT EXISTS idx_businesses_g99_id ON public.businesses USING btree (g99_business_id);

CREATE INDEX IF NOT EXISTS idx_businesses_is_active ON public.businesses USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_businesses_tenant_id ON public.businesses USING btree (g99_tenant_id);

CREATE INDEX IF NOT EXISTS idx_businesses_tier ON public.businesses USING btree (tier);

CREATE INDEX IF NOT EXISTS idx_clinic_concerns_clinic ON public.clinic_concerns USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_concerns_concern ON public.clinic_concerns USING btree (concern_id);

CREATE INDEX IF NOT EXISTS idx_clinic_locations_city ON public.clinic_locations USING btree (lower(city));

CREATE INDEX IF NOT EXISTS idx_clinic_locations_clinic ON public.clinic_locations USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_locations_geo ON public.clinic_locations USING gist (geo) WHERE (geo IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_clinic_locations_primary ON public.clinic_locations USING btree (clinic_id) WHERE (is_primary = true);

CREATE INDEX IF NOT EXISTS idx_clinic_locations_state ON public.clinic_locations USING btree (state);

CREATE INDEX IF NOT EXISTS idx_clinic_service_changes_clinic ON public.clinic_service_changes USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_service_changes_detected ON public.clinic_service_changes USING btree (detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_service_changes_service ON public.clinic_service_changes USING btree (service_id);

CREATE INDEX IF NOT EXISTS idx_clinic_service_changes_type ON public.clinic_service_changes USING btree (change_type);

CREATE INDEX IF NOT EXISTS idx_clinic_service_concerns_clinic ON public.clinic_service_concerns USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_service_concerns_service ON public.clinic_service_concerns USING btree (service_id);

CREATE INDEX IF NOT EXISTS idx_clinic_service_concerns_concern ON public.clinic_service_concerns USING btree (concern_id);

CREATE INDEX IF NOT EXISTS idx_clinic_services_clinic_id ON public.clinic_services USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_services_fts ON public.clinic_services USING gin (to_tsvector('english'::regconfig, ((COALESCE(raw_name, ''::text) || ' '::text) || COALESCE(description, ''::text))));

CREATE INDEX IF NOT EXISTS idx_clinic_services_is_active ON public.clinic_services USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_clinic_services_service_id ON public.clinic_services USING btree (service_id);

CREATE INDEX IF NOT EXISTS idx_clinics_business_id ON public.clinics USING btree (business_id);

CREATE INDEX IF NOT EXISTS idx_clinics_city ON public.clinics USING btree (lower(city));

CREATE INDEX IF NOT EXISTS idx_clinics_fts ON public.clinics USING gin (to_tsvector('english'::regconfig, ((COALESCE(name, ''::text) || ' '::text) || COALESCE(city, ''::text))));

CREATE INDEX IF NOT EXISTS idx_clinics_g99_id ON public.clinics USING btree (g99_clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinics_geo ON public.clinics USING gist (geo);

CREATE INDEX IF NOT EXISTS idx_clinics_google_place ON public.clinics USING btree (google_place_id);

CREATE INDEX IF NOT EXISTS idx_clinics_is_active ON public.clinics USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_clinics_slug ON public.clinics USING btree (business_id, slug);

CREATE INDEX IF NOT EXISTS idx_clinics_state ON public.clinics USING btree (lower(state));

CREATE INDEX IF NOT EXISTS idx_clinics_tier ON public.clinics USING btree (tier);

CREATE INDEX IF NOT EXISTS idx_clinics_website ON public.clinics USING btree (website);

CREATE INDEX IF NOT EXISTS idx_concern_services_concern ON public.concern_services USING btree (concern_id);

CREATE INDEX IF NOT EXISTS idx_concern_services_service ON public.concern_services USING btree (service_id);

CREATE INDEX IF NOT EXISTS idx_concerns_published ON public.concerns USING btree (is_published, is_active);

CREATE INDEX IF NOT EXISTS idx_concerns_slug ON public.concerns USING btree (slug);

CREATE INDEX IF NOT EXISTS idx_csv_avg_rating ON public.clinic_search_view USING btree (avg_rating DESC);

CREATE INDEX IF NOT EXISTS idx_csv_city ON public.clinic_search_view USING btree (lower(city));

CREATE UNIQUE INDEX IF NOT EXISTS idx_csv_clinic_id ON public.clinic_search_view USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_csv_geo ON public.clinic_search_view USING gist (geo);

CREATE INDEX IF NOT EXISTS idx_csv_service_slugs ON public.clinic_search_view USING gin (service_slugs);

CREATE INDEX IF NOT EXISTS idx_csv_state ON public.clinic_search_view USING btree (lower(state));

CREATE INDEX IF NOT EXISTS idx_csv_tier ON public.clinic_search_view USING btree (tier);

CREATE INDEX IF NOT EXISTS idx_images_entity ON public.images USING btree (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_images_role ON public.images USING btree (entity_type, entity_id, role);

CREATE INDEX IF NOT EXISTS idx_images_scrape_status ON public.images USING btree (scrape_status);

CREATE INDEX IF NOT EXISTS idx_images_scraped_domain ON public.images USING btree (scraped_domain);

CREATE INDEX IF NOT EXISTS idx_listing_claims_business_id ON public.listing_claims USING btree (business_id);

CREATE INDEX IF NOT EXISTS idx_listing_claims_email ON public.listing_claims USING btree (contact_email);

CREATE INDEX IF NOT EXISTS idx_listing_claims_status ON public.listing_claims USING btree (status);

CREATE INDEX IF NOT EXISTS idx_medspa_leads_created_at ON public.medspa_leads USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medspa_leads_email ON public.medspa_leads USING btree (business_email);

CREATE INDEX IF NOT EXISTS idx_medspa_leads_status ON public.medspa_leads USING btree (status);

CREATE INDEX IF NOT EXISTS idx_provider_concerns_concern ON public.provider_concerns USING btree (concern_id);

CREATE INDEX IF NOT EXISTS idx_provider_concerns_provider ON public.provider_concerns USING btree (provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_services_provider ON public.provider_services USING btree (provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_services_service ON public.provider_services USING btree (service_id);

CREATE INDEX IF NOT EXISTS idx_providers_clinic_id ON public.providers USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_providers_is_active ON public.providers USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_reviews_approved ON public.reviews USING btree (is_approved, is_active);

CREATE INDEX IF NOT EXISTS idx_reviews_clinic ON public.reviews USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_reviews_concern ON public.reviews USING btree (concern_id);

CREATE INDEX IF NOT EXISTS idx_reviews_service ON public.reviews USING btree (service_id);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_clinic_id ON public.scrape_jobs USING btree (clinic_id);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created ON public.scrape_jobs USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON public.scrape_jobs USING btree (status);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_type ON public.scrape_jobs USING btree (job_type);

CREATE INDEX IF NOT EXISTS idx_services_category ON public.services USING btree (category);

CREATE INDEX IF NOT EXISTS idx_services_is_active ON public.services USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_services_slug ON public.services USING btree (slug);


-- TRIGGERS
DROP TRIGGER IF EXISTS trg_businesses_updated_at ON public.businesses;
CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_concerns_updated_at ON public.clinic_concerns;
CREATE TRIGGER trg_clinic_concerns_updated_at BEFORE UPDATE ON public.clinic_concerns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_locations_updated_at ON public.clinic_locations;
CREATE TRIGGER trg_clinic_locations_updated_at BEFORE UPDATE ON public.clinic_locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clinic_services_updated_at ON public.clinic_services;
CREATE TRIGGER trg_clinic_services_updated_at BEFORE UPDATE ON public.clinic_services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clinics_updated_at ON public.clinics;
CREATE TRIGGER trg_clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_concerns_updated_at ON public.concerns;
CREATE TRIGGER trg_concerns_updated_at BEFORE UPDATE ON public.concerns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_images_updated_at ON public.images;
CREATE TRIGGER trg_images_updated_at BEFORE UPDATE ON public.images FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_listing_claims_updated_at ON public.listing_claims;
CREATE TRIGGER trg_listing_claims_updated_at BEFORE UPDATE ON public.listing_claims FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_providers_updated_at ON public.providers;
CREATE TRIGGER trg_providers_updated_at BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_reviews_rating ON public.reviews;
CREATE TRIGGER trg_reviews_rating AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.refresh_clinic_rating();

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_scrape_jobs_updated_at ON public.scrape_jobs;
CREATE TRIGGER trg_scrape_jobs_updated_at BEFORE UPDATE ON public.scrape_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services;
CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_update_medspa_leads_updated_at ON public.medspa_leads;
CREATE TRIGGER trigger_update_medspa_leads_updated_at BEFORE UPDATE ON public.medspa_leads FOR EACH ROW EXECUTE FUNCTION public.update_medspa_leads_updated_at();

--
-- AI Treatment Navigator analytics/session tables
--

CREATE TABLE IF NOT EXISTS public.ai_navigator_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    anonymous_id text,
    ip_hash text,
    user_agent text,
    request jsonb NOT NULL,
    photo_count integer DEFAULT 0 NOT NULL,
    vision_included boolean DEFAULT false NOT NULL,
    ai_response jsonb,
    matched_clinic_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    model text,
    input_tokens integer,
    output_tokens integer,
    latency_ms integer,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + interval '90 days') NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_navigator_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id uuid REFERENCES public.ai_navigator_sessions(id) ON DELETE SET NULL,
    event_name text NOT NULL,
    step text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_navigator_sessions_created
    ON public.ai_navigator_sessions USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_navigator_sessions_expires
    ON public.ai_navigator_sessions USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_navigator_events_session
    ON public.ai_navigator_events USING btree (session_id);

CREATE INDEX IF NOT EXISTS idx_ai_navigator_events_name_created
    ON public.ai_navigator_events USING btree (event_name, created_at DESC);


-- Populate the materialized view (empty on a fresh DB).
REFRESH MATERIALIZED VIEW public.clinic_search_view;
