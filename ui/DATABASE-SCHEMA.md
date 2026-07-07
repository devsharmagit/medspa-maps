# MedSpa Maps — Relational Database Schema (PostgreSQL)

> Derived from [`UI-DATA-MAP.md`](UI-DATA-MAP.md). This is an **entity-first** view: it lists every table and the fields required to populate each entity — independent of which page renders them.
>
> **Scope decisions baked in:**
> - ❌ No pricing anywhere (no `price`, `starting_price`, `price_unit`, promo/discount columns).
> - ❌ No Before & After (no `before_after` table or columns).
> - ✅ Reviews attach to **clinics only** (`review.clinic_id`); no provider/treatment/condition reviews.

## Conventions

- **Engine:** PostgreSQL 14+.
- **Primary keys:** `uuid` defaulting to `gen_random_uuid()` (built-in from PG13; enable `pgcrypto` on older versions).
- **Timestamps:** every core table has `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()` (kept fresh via a trigger).
- **Soft state:** core catalog entities carry `is_active boolean not null default true` (public visibility gate).
- **Slugs:** SEO/URL-facing entities carry a unique `slug`.
- **Enumerations:** implemented as native `CREATE TYPE ... AS ENUM`.
- **Money:** intentionally absent.

---

## Entity relationship overview

```
city ──< clinic ──< clinic_hours
                ├──< clinic_media
                ├──< clinic_stat
                ├──< review                     (reviews are clinic-only)
                ├──< provider                    (provider.clinic_id → clinic)
                ├──< clinic_highlight >── highlight
                └──< clinic_treatment >── treatment

provider ──< provider_credential
         ├──< provider_specialty
         ├──< provider_highlight >── highlight
         └──< provider_treatment >── treatment

treatment ──< clinic_treatment
          ├──< provider_treatment
          └──< condition_treatment >── condition

condition ──< condition_content_block
          └──< condition_treatment

article_category ──< article ──< article_tag >── tag

-- Standalone lead / marketing capture
appointment_request      (nullable FKs → clinic, provider, treatment)
business_lead
newsletter_subscriber
site_stat
```

Legend: `A ──< B` = one-to-many (A has many B). `A >── B` through a junction = many-to-many.

---

## Enum types

```sql
CREATE TYPE clinic_tier      AS ENUM ('standard', 'featured', 'featured_premium', 'customer_favorite');
CREATE TYPE provider_type    AS ENUM ('nurse_practitioner', 'md', 'plastic_surgeon', 'dermatologist');
CREATE TYPE media_kind       AS ENUM ('image', 'video');
CREATE TYPE highlight_scope  AS ENUM ('clinic', 'provider', 'both');
CREATE TYPE condition_block  AS ENUM ('overview', 'highlight_card');
CREATE TYPE lead_source_page AS ENUM ('home', 'search', 'clinic', 'treatment', 'provider', 'concern');
```

---

## 1. `city`

Top Cities directory + location facet.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default gen_random_uuid() | |
| name | text | not null | "Miami" |
| state | text | | "FL" / "Texas" |
| slug | text | unique, not null | "miami" |
| is_featured | boolean | not null default false | shown in Home "Top Cities" |
| created_at / updated_at | timestamptz | not null default now() | |

---

## 2. `clinic`

The MedSpa listing — core entity of Search, Clinic Detail, and every clinic card.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| name | text | not null | "RUMA Medical" |
| slug | text | unique, not null | "ruma-medical-lehi-ut" |
| logo_url | text | | |
| tagline | text | | short description / hero blurb |
| about | text | | long "About" body |
| tier | clinic_tier | not null default 'standard' | Featured / Premium / Customer Favorite |
| is_verified | boolean | not null default false | verified checkmark |
| hero_image_url | text | | |
| video_url | text | | media player |
| address_street | text | | "1850 W Ashton Blvd" |
| address_suite | text | | "Ste 100" |
| city_id | uuid | FK → city(id), null | normalized city |
| city | text | | denormalized display "Lehi" |
| state | text | | "UT" |
| zip | text | | "84043" |
| latitude | numeric(9,6) | | for distance calc |
| longitude | numeric(9,6) | | for distance calc |
| phone | text | | "Call Clinic" |
| booking_url | text | | "Book Appointment" |
| avg_rating | numeric(2,1) | not null default 0 | derived from `review` |
| review_count | integer | not null default 0 | derived from `review` |
| is_active | boolean | not null default true | |
| created_at / updated_at | timestamptz | not null default now() | |

Indexes: `unique(slug)`, `index(city_id)`, `index(tier)`, `index(latitude, longitude)`.

---

## 3. `clinic_hours`

Opening hours → drives "Open Today · 10AM-7PM".

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| clinic_id | uuid | FK → clinic(id) on delete cascade, not null | |
| day_of_week | smallint | not null, check (0..6) | 0=Sunday |
| open_time | time | | null = closed |
| close_time | time | | |
| is_closed | boolean | not null default false | explicit closed day |

Constraint: `unique(clinic_id, day_of_week)`.

---

## 4. `clinic_media`

Gallery thumbnails ("+12 View All").

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| clinic_id | uuid | FK → clinic(id) on delete cascade, not null | |
| url | text | not null | |
| kind | media_kind | not null default 'image' | image / video |
| sort_order | integer | not null default 0 | |

---

## 5. `clinic_stat`

Clinic vanity stats ("20+ Certified Expert", "10k+ Patient Transformed"). Free-form to allow "20+", "10k+".

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| clinic_id | uuid | FK → clinic(id) on delete cascade, not null | |
| label | text | not null | "CERTIFIED EXPERT" |
| value | text | not null | "20+" |
| sort_order | integer | not null default 0 | |

---

## 6. `highlight` (shared lookup) + junctions

Controlled list of highlight phrases reused by clinics and providers ("Natural Looking Results", "Award Winning Team", "Board Certified Nurse Practitioner", "Patient-Centered Care", …).

### 6a. `highlight`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| label | text | unique, not null | "Award Winning Team" |
| icon | text | | icon key/name |
| scope | highlight_scope | not null default 'both' | where it's usable |

### 6b. `clinic_highlight` (junction — clinic checklist bullets)
| Column | Type | Constraints |
|--------|------|-------------|
| clinic_id | uuid | FK → clinic(id) on delete cascade, not null |
| highlight_id | uuid | FK → highlight(id), not null |
| sort_order | integer | not null default 0 |
| **PK** | | (clinic_id, highlight_id) |

### 6c. `provider_highlight` (junction — provider chips)
| Column | Type | Constraints |
|--------|------|-------------|
| provider_id | uuid | FK → provider(id) on delete cascade, not null |
| highlight_id | uuid | FK → highlight(id), not null |
| sort_order | integer | not null default 0 |
| **PK** | | (provider_id, highlight_id) |

---

## 7. `provider`

Doctor / practitioner listing.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| name | text | not null | "Dr. Larissa Joe" |
| slug | text | unique, not null | "dr-larissa-joe" |
| headshot_url | text | | |
| title | text | | "Injectable Specialist" |
| specialty_tagline | text | | one-line role blurb |
| provider_type | provider_type | | filter facet (NP/MD/…) |
| clinic_id | uuid | FK → clinic(id) on delete set null | primary clinic ("RUMA Medical") |
| bio | text | | long biography |
| years_experience | smallint | | 10 → rendered "10+" |
| avg_rating | numeric(2,1) | not null default 0 | display only (no review records) |
| is_verified | boolean | not null default false | verified checkmark |
| phone | text | | |
| booking_url | text | | |
| is_active | boolean | not null default true | |
| created_at / updated_at | timestamptz | not null default now() | |

> Note: `clinic_id` models one primary clinic (matches the mockups and the "Other providers from RUMA" section). If a provider must span multiple clinics, replace with a `clinic_provider(clinic_id, provider_id)` junction.

---

## 8. `provider_credential`

Credentials & Education list.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| provider_id | uuid | FK → provider(id) on delete cascade, not null | |
| credential | text | not null | "Master of Science in Nursing (MSN)" |
| institution | text | | "University of Utah" |
| sort_order | integer | not null default 0 | |

---

## 9. `provider_specialty`

Specialties block (name + description + icon).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| provider_id | uuid | FK → provider(id) on delete cascade, not null | |
| name | text | not null | "Injectables" |
| description | text | | "Botox Dysport, Xeomin, and dermal fillers…" |
| icon | text | | icon key |
| sort_order | integer | not null default 0 | |

---

## 10. `treatment`

Treatment / service catalog. **No pricing.**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| name | text | not null | "Botox" |
| slug | text | unique, not null | "botox" |
| icon | text | | chip/card icon |
| hero_image_url | text | | Treatment Detail hero |
| short_description | text | | hero paragraph |
| treatment_time | text | | "20-30 mins" |
| results_onset | text | | "Within 1 day" |
| duration | text | | "4-6 Months" |
| is_active | boolean | not null default true | |
| created_at / updated_at | timestamptz | not null default now() | |

> `clinic_count` shown on Home "Popular Treatments" is **derived**: `count(*)` from `clinic_treatment` for the treatment.

---

## 11. `clinic_treatment` (junction)

Which treatments a clinic offers. Also the source of the **treatment tag chips** on clinic cards, and of the "Best Clinics" list on the Treatment page. **No price column** (removed).

| Column | Type | Constraints |
|--------|------|-------------|
| clinic_id | uuid | FK → clinic(id) on delete cascade, not null |
| treatment_id | uuid | FK → treatment(id) on delete cascade, not null |
| sort_order | integer | not null default 0 |
| **PK** | | (clinic_id, treatment_id) |

---

## 12. `provider_treatment` (junction)

"Treatment Offered By Dr. …". **No price column.**

| Column | Type | Constraints |
|--------|------|-------------|
| provider_id | uuid | FK → provider(id) on delete cascade, not null |
| treatment_id | uuid | FK → treatment(id) on delete cascade, not null |
| sort_order | integer | not null default 0 |
| **PK** | | (provider_id, treatment_id) |

---

## 13. `condition`

Concern / condition (e.g., "Fine Lines & Wrinkles").

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| name | text | not null | "Fine Lines & Wrinkles" |
| slug | text | unique, not null | "fine-lines-wrinkles" |
| intro_heading | text | | "What are Wrinkles?" |
| is_active | boolean | not null default true | |
| created_at / updated_at | timestamptz | not null default now() | |

---

## 14. `condition_content_block`

Flexible content blocks for the Overview tab — both the left "Signs of Aging / Causes / Candidate / Expected Results" list and the right info cards ("Common Treatment Areas", "Injectable Treatments", "Benefits", "Preventative Aging Care"). Titles vary per condition, so they are stored, not hardcoded.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| condition_id | uuid | FK → condition(id) on delete cascade, not null | |
| block_group | condition_block | not null | 'overview' or 'highlight_card' |
| title | text | not null | "Signs of Aging" / "Benefits" |
| body | text | not null | block copy |
| sort_order | integer | not null default 0 | |

---

## 15. `condition_treatment` (junction)

Treatments relevant to a concern. Clinics/providers shown on the Concern tabs are **derived** through this link (`condition → treatment → clinic_treatment / provider_treatment`).

| Column | Type | Constraints |
|--------|------|-------------|
| condition_id | uuid | FK → condition(id) on delete cascade, not null |
| treatment_id | uuid | FK → treatment(id) on delete cascade, not null |
| **PK** | | (condition_id, treatment_id) |

---

## 16. `review` — **clinic-only**

"What our Client Says" content. Attaches to a clinic and nothing else.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| clinic_id | uuid | FK → clinic(id) on delete cascade, not null | reviews belong to clinics only |
| author_name | text | not null | "Jessica R." |
| author_photo_url | text | | optional avatar |
| rating | smallint | not null, check (rating between 1 and 5) | stars |
| body | text | not null | testimonial text |
| source | text | | "Google" / "site" etc. |
| is_published | boolean | not null default true | moderation gate |
| created_at | timestamptz | not null default now() | |

> `clinic.avg_rating` and `clinic.review_count` are maintained from this table (trigger or scheduled recompute).

---

## 17. `article_category`

Resource categories ("Treatments", "Skin Care", "Wellness", "Business Tips", "Patient Guide").

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| name | text | not null | "Skin Care" |
| slug | text | unique, not null | "skin-care" |
| sort_order | integer | not null default 0 | |

> The "N Articles" count per category is **derived**.

---

## 18. `article`

Resource / blog article.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| title | text | not null | "Benefits of Laser Hair Treatments" |
| slug | text | unique, not null | |
| category_id | uuid | FK → article_category(id), not null | |
| excerpt | text | | |
| body | text | | article content |
| thumbnail_url | text | | |
| author | text | | |
| read_time_minutes | smallint | | "5 min read" |
| published_at | date | | "May 12, 2026" |
| is_active | boolean | not null default true | |
| created_at / updated_at | timestamptz | not null default now() | |

---

## 19. `tag` + `article_tag`

Popular Topics ("Botox", "Fillers", "Laser Treatments", "Acne", "Anti Aging").

### 19a. `tag`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| name | text | unique, not null | "Anti Aging" |
| slug | text | unique, not null | "anti-aging" |
| is_popular | boolean | not null default false | shown in "Popular Topics" |

### 19b. `article_tag` (junction)
| Column | Type | Constraints |
|--------|------|-------------|
| article_id | uuid | FK → article(id) on delete cascade, not null |
| tag_id | uuid | FK → tag(id) on delete cascade, not null |
| **PK** | | (article_id, tag_id) |

---

## 20. `appointment_request`

"Book Your Appointment" form (all inner pages). Context FKs are nullable — captured based on the page.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| full_name | text | not null | |
| mobile_number | text | not null | |
| treatment_id | uuid | FK → treatment(id), null | "Select Treatment" |
| clinic_id | uuid | FK → clinic(id), null | booking context |
| provider_id | uuid | FK → provider(id), null | booking context |
| preferred_date | date | | "Preferred Time" (date) |
| preferred_time | text | | "Preferred Time" (slot) |
| source_page | lead_source_page | | which page submitted |
| created_at | timestamptz | not null default now() | |

---

## 21. `business_lead`

"Claim Your Benefits" / "List Your Medspa" provider signup.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| full_name | text | not null | |
| business_email | text | not null | |
| business_name | text | not null | |
| created_at | timestamptz | not null default now() | |

---

## 22. `newsletter_subscriber`

Footer + newsletter band email capture.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| email | text | unique, not null | |
| created_at | timestamptz | not null default now() | |

---

## 23. `site_stat`

Editable Home "Trusted by Thousands" marketing stats ("12,500+ Verified Clinics", etc.). Free-form value to allow "12,500+".

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK | |
| key | text | unique, not null | "verified_clinics" |
| label | text | not null | "VERIFIED CLINICS" |
| value | text | not null | "12,500+" |
| sort_order | integer | not null default 0 | |

---

## Derived / computed values (not stored as columns)

| Value | Source |
|-------|--------|
| Clinic "X Miles Away" | `earthdistance`/PostGIS on `clinic.latitude/longitude` vs. user location |
| Treatment "N clinics" (Home) | `count(clinic_treatment)` per treatment |
| "48 Clinics/Providers Found" | filtered result counts |
| Clinic card treatment tag chips | `clinic_treatment → treatment.name` |
| `clinic.avg_rating`, `clinic.review_count` | aggregated from `review` |
| Category "N Articles" | `count(article)` per `article_category` |
| Concern → clinics / providers lists | `condition_treatment → clinic_treatment / provider_treatment` |
| "Open Today" | `clinic_hours` vs. current day/time |

---

## DDL (reference)

```sql
-- Extensions & enums
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE clinic_tier      AS ENUM ('standard','featured','featured_premium','customer_favorite');
CREATE TYPE provider_type    AS ENUM ('nurse_practitioner','md','plastic_surgeon','dermatologist');
CREATE TYPE media_kind       AS ENUM ('image','video');
CREATE TYPE highlight_scope  AS ENUM ('clinic','provider','both');
CREATE TYPE condition_block  AS ENUM ('overview','highlight_card');
CREATE TYPE lead_source_page AS ENUM ('home','search','clinic','treatment','provider','concern');

CREATE TABLE city (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  state       text,
  slug        text UNIQUE NOT NULL,
  is_featured boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clinic (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  slug           text UNIQUE NOT NULL,
  logo_url       text,
  tagline        text,
  about          text,
  tier           clinic_tier NOT NULL DEFAULT 'standard',
  is_verified    boolean NOT NULL DEFAULT false,
  hero_image_url text,
  video_url      text,
  address_street text,
  address_suite  text,
  city_id        uuid REFERENCES city(id),
  city           text,
  state          text,
  zip            text,
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  phone          text,
  booking_url    text,
  avg_rating     numeric(2,1) NOT NULL DEFAULT 0,
  review_count   integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clinic_hours (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  day_of_week  smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time    time,
  close_time   time,
  is_closed    boolean NOT NULL DEFAULT false,
  UNIQUE (clinic_id, day_of_week)
);

CREATE TABLE clinic_media (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  url        text NOT NULL,
  kind       media_kind NOT NULL DEFAULT 'image',
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE clinic_stat (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  label      text NOT NULL,
  value      text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE highlight (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text UNIQUE NOT NULL,
  icon  text,
  scope highlight_scope NOT NULL DEFAULT 'both'
);

CREATE TABLE clinic_highlight (
  clinic_id    uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  highlight_id uuid NOT NULL REFERENCES highlight(id),
  sort_order   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (clinic_id, highlight_id)
);

CREATE TABLE provider (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text UNIQUE NOT NULL,
  headshot_url      text,
  title             text,
  specialty_tagline text,
  provider_type     provider_type,
  clinic_id         uuid REFERENCES clinic(id) ON DELETE SET NULL,
  bio               text,
  years_experience  smallint,
  avg_rating        numeric(2,1) NOT NULL DEFAULT 0,
  is_verified       boolean NOT NULL DEFAULT false,
  phone             text,
  booking_url       text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_highlight (
  provider_id  uuid NOT NULL REFERENCES provider(id) ON DELETE CASCADE,
  highlight_id uuid NOT NULL REFERENCES highlight(id),
  sort_order   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (provider_id, highlight_id)
);

CREATE TABLE provider_credential (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id) ON DELETE CASCADE,
  credential  text NOT NULL,
  institution text,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE provider_specialty (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  icon        text,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE treatment (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text UNIQUE NOT NULL,
  icon              text,
  hero_image_url    text,
  short_description text,
  treatment_time    text,
  results_onset     text,
  duration          text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clinic_treatment (
  clinic_id    uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  treatment_id uuid NOT NULL REFERENCES treatment(id) ON DELETE CASCADE,
  sort_order   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (clinic_id, treatment_id)
);

CREATE TABLE provider_treatment (
  provider_id  uuid NOT NULL REFERENCES provider(id) ON DELETE CASCADE,
  treatment_id uuid NOT NULL REFERENCES treatment(id) ON DELETE CASCADE,
  sort_order   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (provider_id, treatment_id)
);

CREATE TABLE condition (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text UNIQUE NOT NULL,
  intro_heading text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE condition_content_block (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id uuid NOT NULL REFERENCES condition(id) ON DELETE CASCADE,
  block_group  condition_block NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0
);

CREATE TABLE condition_treatment (
  condition_id uuid NOT NULL REFERENCES condition(id) ON DELETE CASCADE,
  treatment_id uuid NOT NULL REFERENCES treatment(id) ON DELETE CASCADE,
  PRIMARY KEY (condition_id, treatment_id)
);

-- Reviews attach to clinics ONLY
CREATE TABLE review (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  author_name      text NOT NULL,
  author_photo_url text,
  rating           smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body             text NOT NULL,
  source           text,
  is_published     boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE article_category (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE article (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  slug              text UNIQUE NOT NULL,
  category_id       uuid NOT NULL REFERENCES article_category(id),
  excerpt           text,
  body              text,
  thumbnail_url     text,
  author            text,
  read_time_minutes smallint,
  published_at      date,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tag (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  slug       text UNIQUE NOT NULL,
  is_popular boolean NOT NULL DEFAULT false
);

CREATE TABLE article_tag (
  article_id uuid NOT NULL REFERENCES article(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE TABLE appointment_request (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      text NOT NULL,
  mobile_number  text NOT NULL,
  treatment_id   uuid REFERENCES treatment(id),
  clinic_id      uuid REFERENCES clinic(id),
  provider_id    uuid REFERENCES provider(id),
  preferred_date date,
  preferred_time text,
  source_page    lead_source_page,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE business_lead (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      text NOT NULL,
  business_email text NOT NULL,
  business_name  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE newsletter_subscriber (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE site_stat (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text UNIQUE NOT NULL,
  label      text NOT NULL,
  value      text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- Helpful indexes
CREATE INDEX idx_clinic_city          ON clinic(city_id);
CREATE INDEX idx_clinic_tier          ON clinic(tier);
CREATE INDEX idx_clinic_geo           ON clinic(latitude, longitude);
CREATE INDEX idx_provider_clinic      ON provider(clinic_id);
CREATE INDEX idx_provider_type        ON provider(provider_type);
CREATE INDEX idx_review_clinic        ON review(clinic_id);
CREATE INDEX idx_article_category     ON article(category_id);
CREATE INDEX idx_ctreatment_treatment ON clinic_treatment(treatment_id);
CREATE INDEX idx_ptreatment_treatment ON provider_treatment(treatment_id);
CREATE INDEX idx_condtreat_treatment  ON condition_treatment(treatment_id);
```
