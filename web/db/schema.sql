--
-- PostgreSQL database dump
--

\restrict cy9KavMYyfPWWmaGvNiputYHERUwR5lBedC7sMhxnbXh6CjAiflZTXyRRplaaFV

-- Dumped from database version 18.4 (709c4c3)
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: refresh_clinic_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_clinic_rating() RETURNS trigger
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


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$;


--
-- Name: slugify(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.slugify(val text) RETURNS text
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_navigator_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_navigator_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    event_name text NOT NULL,
    step text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_navigator_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_navigator_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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
    expires_at timestamp with time zone DEFAULT (now() + '90 days'::interval) NOT NULL
);


--
-- Name: clinic_concerns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_concerns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    concern_id uuid NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinic_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_locations (
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


--
-- Name: clinic_service_concerns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_service_concerns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    service_id uuid NOT NULL,
    concern_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    extracted_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clinic_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    service_id uuid,
    raw_name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    price_from numeric,
    price_unit text,
    match_status text DEFAULT 'unmatched'::text
);


--
-- Name: clinics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    website text NOT NULL,
    booking_url text,
    address text,
    country text DEFAULT 'US'::text,
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
    google_maps_url text,
    ext_rating_source text,
    ext_rating_updated_at timestamp with time zone,
    g99_business_id bigint,
    g99_tenant_id bigint
);


--
-- Name: concerns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concerns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    origin text DEFAULT 'seed'::text NOT NULL
);


--
-- Name: g99_clinic_websites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.g99_clinic_websites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain text NOT NULL,
    website text NOT NULL,
    g99_clinic_ids bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    g99_business_ids bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    clinic_count integer DEFAULT 0 NOT NULL,
    business_count integer DEFAULT 0 NOT NULL,
    business_name text,
    clinic_name text,
    specialization text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.images (
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


--
-- Name: postal_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postal_codes (
    id bigint NOT NULL,
    country_code text DEFAULT 'US'::text NOT NULL,
    postal_code text NOT NULL,
    place_name text NOT NULL,
    state_name text,
    state_code text,
    county text,
    lat numeric(9,6),
    lng numeric(9,6),
    source text DEFAULT 'geonames'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: postal_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.postal_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: postal_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.postal_codes_id_seq OWNED BY public.postal_codes.id;


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    name text NOT NULL,
    title text,
    image_url text,
    is_verified boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    card_tagline text
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
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


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    origin text DEFAULT 'seed'::text NOT NULL
);


--
-- Name: postal_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes ALTER COLUMN id SET DEFAULT nextval('public.postal_codes_id_seq'::regclass);


--
-- Name: clinics clinics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);


--
-- Name: clinic_search_view; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.clinic_search_view AS
 SELECT c.id AS clinic_id,
    c.name AS clinic_name,
    c.slug AS clinic_slug,
    c.website,
    c.booking_url,
    c.about,
    c.phone,
    c.avg_rating,
    c.review_count,
    c.ext_rating,
    c.ext_review_count,
    c.featured,
    COALESCE(array_agg(DISTINCT COALESCE(sv.name, cs.raw_name)) FILTER (WHERE (cs.is_active = true)), '{}'::text[]) AS service_names,
    COALESCE(array_agg(DISTINCT COALESCE(sv.slug, public.slugify(cs.raw_name))) FILTER (WHERE (cs.is_active = true)), '{}'::text[]) AS service_slugs,
    ( SELECT i.source_url
           FROM public.images i
          WHERE ((i.entity_type = 'clinic'::text) AND (i.entity_id = c.id) AND (i.role = 'cover'::text) AND (i.scrape_status = 'ok'::text))
          ORDER BY i.sort_order
         LIMIT 1) AS cover_image_url,
    ( SELECT i.source_url
           FROM public.images i
          WHERE ((i.entity_type = 'clinic'::text) AND (i.entity_id = c.id) AND (i.role = 'logo'::text) AND (i.scrape_status = 'ok'::text))
          ORDER BY i.sort_order
         LIMIT 1) AS logo_url
   FROM ((public.clinics c
     LEFT JOIN public.clinic_services cs ON ((cs.clinic_id = c.id)))
     LEFT JOIN public.services sv ON ((sv.id = cs.service_id)))
  WHERE (c.is_active = true)
  GROUP BY c.id
  WITH NO DATA;


--
-- Name: admin_users admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: ai_navigator_events ai_navigator_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_navigator_events
    ADD CONSTRAINT ai_navigator_events_pkey PRIMARY KEY (id);


--
-- Name: ai_navigator_sessions ai_navigator_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_navigator_sessions
    ADD CONSTRAINT ai_navigator_sessions_pkey PRIMARY KEY (id);


--
-- Name: clinic_concerns clinic_concerns_clinic_id_concern_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_concerns
    ADD CONSTRAINT clinic_concerns_clinic_id_concern_id_key UNIQUE (clinic_id, concern_id);


--
-- Name: clinic_concerns clinic_concerns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_concerns
    ADD CONSTRAINT clinic_concerns_pkey PRIMARY KEY (id);


--
-- Name: clinic_locations clinic_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_locations
    ADD CONSTRAINT clinic_locations_pkey PRIMARY KEY (id);


--
-- Name: clinic_service_concerns clinic_service_concerns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_service_concerns
    ADD CONSTRAINT clinic_service_concerns_pkey PRIMARY KEY (id);


--
-- Name: clinic_services clinic_services_clinic_id_raw_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_clinic_id_raw_name_key UNIQUE (clinic_id, raw_name);


--
-- Name: clinic_services clinic_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_pkey PRIMARY KEY (id);


--
-- Name: clinics clinics_g99_clinic_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_g99_clinic_id_key UNIQUE (g99_clinic_id);


--
-- Name: clinics clinics_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_slug_key UNIQUE (slug);


--
-- Name: concerns concerns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concerns
    ADD CONSTRAINT concerns_pkey PRIMARY KEY (id);


--
-- Name: concerns concerns_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concerns
    ADD CONSTRAINT concerns_slug_key UNIQUE (slug);


--
-- Name: g99_clinic_websites g99_clinic_websites_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.g99_clinic_websites
    ADD CONSTRAINT g99_clinic_websites_domain_key UNIQUE (domain);


--
-- Name: g99_clinic_websites g99_clinic_websites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.g99_clinic_websites
    ADD CONSTRAINT g99_clinic_websites_pkey PRIMARY KEY (id);


--
-- Name: images images_entity_type_entity_id_source_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_entity_type_entity_id_source_url_key UNIQUE (entity_type, entity_id, source_url);


--
-- Name: images images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_pkey PRIMARY KEY (id);


--
-- Name: postal_codes postal_codes_country_code_postal_code_place_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes
    ADD CONSTRAINT postal_codes_country_code_postal_code_place_name_key UNIQUE (country_code, postal_code, place_name);


--
-- Name: postal_codes postal_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes
    ADD CONSTRAINT postal_codes_pkey PRIMARY KEY (id);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_content_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_content_hash_key UNIQUE (content_hash);


--
-- Name: reviews reviews_g99_review_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_g99_review_id_key UNIQUE (g99_review_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: services services_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_slug_key UNIQUE (slug);


--
-- Name: idx_ai_navigator_events_name_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_navigator_events_name_created ON public.ai_navigator_events USING btree (event_name, created_at DESC);


--
-- Name: idx_ai_navigator_events_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_navigator_events_session ON public.ai_navigator_events USING btree (session_id);


--
-- Name: idx_ai_navigator_sessions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_navigator_sessions_created ON public.ai_navigator_sessions USING btree (created_at DESC);


--
-- Name: idx_ai_navigator_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_navigator_sessions_expires ON public.ai_navigator_sessions USING btree (expires_at);


--
-- Name: idx_clinic_concerns_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_concerns_clinic ON public.clinic_concerns USING btree (clinic_id);


--
-- Name: idx_clinic_concerns_concern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_concerns_concern ON public.clinic_concerns USING btree (concern_id);


--
-- Name: idx_clinic_locations_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_locations_city ON public.clinic_locations USING btree (lower(city));


--
-- Name: idx_clinic_locations_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_locations_clinic ON public.clinic_locations USING btree (clinic_id);


--
-- Name: idx_clinic_locations_geo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_locations_geo ON public.clinic_locations USING gist (geo) WHERE (geo IS NOT NULL);


--
-- Name: idx_clinic_locations_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_locations_primary ON public.clinic_locations USING btree (clinic_id) WHERE (is_primary = true);


--
-- Name: idx_clinic_locations_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_locations_state ON public.clinic_locations USING btree (state);


--
-- Name: idx_clinic_services_clinic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_services_clinic_id ON public.clinic_services USING btree (clinic_id);


--
-- Name: idx_clinic_services_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_services_fts ON public.clinic_services USING gin (to_tsvector('english'::regconfig, ((COALESCE(raw_name, ''::text) || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_clinic_services_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_services_is_active ON public.clinic_services USING btree (is_active);


--
-- Name: idx_clinic_services_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_services_service_id ON public.clinic_services USING btree (service_id);


--
-- Name: idx_clinics_g99_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_g99_id ON public.clinics USING btree (g99_clinic_id);


--
-- Name: idx_clinics_google_place; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_google_place ON public.clinics USING btree (google_place_id);


--
-- Name: idx_clinics_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_is_active ON public.clinics USING btree (is_active);


--
-- Name: idx_clinics_website; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_website ON public.clinics USING btree (website);


--
-- Name: idx_concerns_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_concerns_slug ON public.concerns USING btree (slug);


--
-- Name: idx_csc_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csc_clinic ON public.clinic_service_concerns USING btree (clinic_id);


--
-- Name: idx_csc_concern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csc_concern ON public.clinic_service_concerns USING btree (concern_id);


--
-- Name: idx_csc_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csc_service ON public.clinic_service_concerns USING btree (service_id);


--
-- Name: idx_csv_clinic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_csv_clinic_id ON public.clinic_search_view USING btree (clinic_id);


--
-- Name: idx_csv_service_slugs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csv_service_slugs ON public.clinic_search_view USING gin (service_slugs);


--
-- Name: idx_g99_clinic_websites_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_g99_clinic_websites_domain ON public.g99_clinic_websites USING btree (domain);


--
-- Name: idx_images_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_images_entity ON public.images USING btree (entity_type, entity_id);


--
-- Name: idx_images_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_images_role ON public.images USING btree (entity_type, entity_id, role);


--
-- Name: idx_images_scrape_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_images_scrape_status ON public.images USING btree (scrape_status);


--
-- Name: idx_images_scraped_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_images_scraped_domain ON public.images USING btree (scraped_domain);


--
-- Name: idx_providers_clinic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_providers_clinic_id ON public.providers USING btree (clinic_id);


--
-- Name: idx_providers_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_providers_is_active ON public.providers USING btree (is_active);


--
-- Name: idx_reviews_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_approved ON public.reviews USING btree (is_approved, is_active);


--
-- Name: idx_reviews_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_clinic ON public.reviews USING btree (clinic_id);


--
-- Name: idx_reviews_concern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_concern ON public.reviews USING btree (concern_id);


--
-- Name: idx_reviews_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_service ON public.reviews USING btree (service_id);


--
-- Name: idx_services_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_is_active ON public.services USING btree (is_active);


--
-- Name: idx_services_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_slug ON public.services USING btree (slug);


--
-- Name: postal_codes_place_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX postal_codes_place_trgm_idx ON public.postal_codes USING gin (lower(place_name) public.gin_trgm_ops);


--
-- Name: postal_codes_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX postal_codes_state_idx ON public.postal_codes USING btree (state_code);


--
-- Name: postal_codes_zip_prefix_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX postal_codes_zip_prefix_idx ON public.postal_codes USING btree (country_code, postal_code text_pattern_ops);


--
-- Name: clinic_concerns trg_clinic_concerns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinic_concerns_updated_at BEFORE UPDATE ON public.clinic_concerns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: clinic_locations trg_clinic_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinic_locations_updated_at BEFORE UPDATE ON public.clinic_locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: clinic_services trg_clinic_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinic_services_updated_at BEFORE UPDATE ON public.clinic_services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: clinics trg_clinics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: concerns trg_concerns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_concerns_updated_at BEFORE UPDATE ON public.concerns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: images trg_images_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_images_updated_at BEFORE UPDATE ON public.images FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: providers trg_providers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_providers_updated_at BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reviews trg_reviews_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reviews_rating AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.refresh_clinic_rating();


--
-- Name: reviews trg_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: services trg_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_navigator_events ai_navigator_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_navigator_events
    ADD CONSTRAINT ai_navigator_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ai_navigator_sessions(id) ON DELETE SET NULL;


--
-- Name: clinic_concerns clinic_concerns_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_concerns
    ADD CONSTRAINT clinic_concerns_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_concerns clinic_concerns_concern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_concerns
    ADD CONSTRAINT clinic_concerns_concern_id_fkey FOREIGN KEY (concern_id) REFERENCES public.concerns(id) ON DELETE CASCADE;


--
-- Name: clinic_locations clinic_locations_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_locations
    ADD CONSTRAINT clinic_locations_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_service_concerns clinic_service_concerns_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_service_concerns
    ADD CONSTRAINT clinic_service_concerns_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_service_concerns clinic_service_concerns_concern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_service_concerns
    ADD CONSTRAINT clinic_service_concerns_concern_id_fkey FOREIGN KEY (concern_id) REFERENCES public.concerns(id) ON DELETE CASCADE;


--
-- Name: clinic_service_concerns clinic_service_concerns_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_service_concerns
    ADD CONSTRAINT clinic_service_concerns_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: clinic_services clinic_services_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: clinic_services clinic_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: providers providers_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_concern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_concern_id_fkey FOREIGN KEY (concern_id) REFERENCES public.concerns(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict cy9KavMYyfPWWmaGvNiputYHERUwR5lBedC7sMhxnbXh6CjAiflZTXyRRplaaFV



--
-- Name: patient_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.patient_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    source text DEFAULT 'search'::text NOT NULL,
    treatment text,
    concern text,
    location text,
    skin_navigator jsonb,
    ip_address text,
    user_agent text,
    status text DEFAULT 'new'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_leads_source_check CHECK ((source = ANY (ARRAY['search'::text, 'skin_navigator'::text]))),
    CONSTRAINT patient_leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'converted'::text, 'rejected'::text]))),
    CONSTRAINT patient_leads_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_patient_leads_created_at ON public.patient_leads USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_leads_source ON public.patient_leads USING btree (source);
CREATE INDEX IF NOT EXISTS idx_patient_leads_email ON public.patient_leads USING btree (email);
CREATE INDEX IF NOT EXISTS idx_patient_leads_status ON public.patient_leads USING btree (status);
