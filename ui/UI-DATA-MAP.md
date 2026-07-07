# MedSpa Maps — UI Data Map

> Data-point mapping derived from the Figma mockups in `/ui`.
> Every screen, section, and field visible in the mockups is catalogued below, mapped to the underlying data entity that must supply it.

### Applied scope changes (v2)
This revision reflects three product decisions:
1. **Before & After removed everywhere** — the "Before & After Results" sections (and the entity) are dropped from every page.
2. **All pricing removed everywhere** — "Starting at $X", "Starting from $X", "$X/Unit" price panels, and promo/discount badges ("15% OFF", "10% OFF + 5% OFF…") are dropped from every page and every entity.
3. **Reviews only on the Clinic page** — the "What our Client Says" review section and the `review` entity belong to the **Clinic Detail page only**. They are removed from Home, Search, Treatment, Provider, and Concern pages. (Aggregate **rating** badges that are intrinsic clinic metadata still appear on clinic cards wherever clinics are listed; they are sourced from the clinic's own reviews. Provider profile keeps a plain `avg_rating` display value not backed by review records.)

> A companion relational schema for these entities lives in [`DATABASE-SCHEMA.md`](DATABASE-SCHEMA.md).

**Source files analysed (8 images):**

| # | File | Screen | Canvas size |
|---|------|--------|-------------|
| 1 | `Medspa Home - Final.png` | Home / Landing | 1440 × 5617 |
| 2 | `Medspa - Search Results Page.png` | Search Results (treatment near location) | 1440 × 3991 |
| 3 | `Medspa - Clinic Individual.png` | Clinic Detail | 1440 × 4098 |
| 4 | `Medspa - Service Individual Page.png` | Treatment / Service Detail | 1440 × 3698 |
| 5 | `Medspa - Provider Individual.png` | Provider / Doctor Detail | 1440 × 4437 |
| 6 | `Medspa - Concern Page 1.png` | Concern — **Overview** tab | 1440 × 3183 |
| 7 | `Medspa - Concern Page 2.png` | Concern — **Clinics & Diagnosis** tab | 1440 × 3403 |
| 8 | `Medspa - Concern Page 3.png` | Concern — **Doctors & Providers** tab | 1440 × 3192 |

---

## Core data entities (correlated across all screens)

The same handful of entities are reused across every page. (Pricing, before/after, and non-clinic reviews have been removed per the scope changes above.)

| Entity | Key fields (union of everything shown across screens) |
|--------|-------------------------------------------------------|
| **Clinic / MedSpa** | id, name, logo, verified_badge (bool), tier (Featured / Featured Premium / Customer Favorite / Standard), city, state, address (street, suite, city, state, zip), latitude/longitude (for distance), distance_from_user (mi, computed), avg_rating, review_count, hero_image, video_url, gallery_images[] (+N "View All"), treatment_tags[] (derived from offered treatments), highlight_bullets[] (Natural Looking Results / 15+ Years Of Experience / Award Winning Team / Highly Rated On Google), about_description, tagline/short_description, open_status (Open Today) + hours, vanity_stats[] (Certified Expert / Cities Covered / Advanced Treatment / Patient Transformed), favorite (bool, per-user), booking_url, phone |
| **Provider / Doctor** | id, name, verified_badge, headshot, title/role ("Injectable Specialist"), specialty_tagline, provider_type (Nurse Practitioner / MD / Plastic Surgeon / Dermatologist), years_experience ("10+"), clinic (name + link), city/state, avg_rating (display only), bio, credentials[] (degree + institution), specialties[] (name + description + icon), highlight_chips[] (Board Certified Nurse Practitioner / Expert in Facial Aesthetics / Natural Looking Results / Patient-Centered Care), treatments_offered[], booking_url, phone |
| **Treatment / Service** | id, name, icon, hero_image, short_description, treatment_time, results_onset, duration/longevity, clinic_count ("48 Clinics Found", derived) |
| **Concern / Condition** | id, name ("Fine Lines & Wrinkles"), overview blocks (Signs of Aging, Causes, Who Is a Candidate, Expected Results), info cards (Common Treatment Areas, Injectable Treatments, Benefits, Preventative Aging Care), related treatments[], related clinics[] (derived), related providers[] (derived) |
| **Review / Testimonial** *(Clinic page only)* | id, clinic_id, rating (stars), body_text, author_name ("Jessica R."), author_photo (optional), source |
| **Article / Resource** | id, category ("Treatments"), title, publish_date, read_time ("5 min read"), thumbnail, excerpt, tags[] |
| **City** | id, name, state, slug, is_featured (Top Cities) |
| **User / Lead (forms)** | full_name, email, business_email, business_name, mobile_number, preferred_date, preferred_time, selected_treatment |

---

## 0. Global / shared components (appear on every page)

### 0.1 Header / Navigation bar

| Data Point | Type | Example / Value | Notes |
|------------|------|-----------------|-------|
| Logo | image + wordmark | "MEDSPA" (mountain mark) | Links to Home |
| Nav: Treatments | dropdown | "Treatments ▾" | Has submenu |
| Nav: Clinics | link | "Clinics" | |
| Nav: Before & After | link | "Before & After" | ⚠️ Feature content removed — nav item likely to be repurposed/removed |
| Nav: Best of 2026 | link | "Best of 2026" | |
| Nav: Reviews | link | "Reviews" | |
| Nav: Resources | dropdown | "Resources ▾" | Has submenu |
| CTA: List Your Medspa | button (outline) | "List Your Medspa" | Provider acquisition |
| CTA: Login / Signup | button (filled) | "Login / Signup" | Auth |

### 0.2 Breadcrumb (inner pages)

| Data Point | Type | Example |
|------------|------|---------|
| Breadcrumb trail | path | `Home › Clinics › Ruma, Lehi, UT` / `Home › Treatments › Botox` / `Home › Concerns` / `Home › Clinics › Ruma, Lehi, UT › Dr. larissa Joe` |

### 0.3 "Book Your Appointment" CTA band (recurring on all inner pages)

| Data Point | Type | Example |
|------------|------|---------|
| Heading | text | "Book Your Appointment" |
| Sub-copy | text | "take the first step towards healthy, glowing skin. book your consultation today!" |
| Field: Full Name | text input | placeholder "Full Name" |
| Field: Mobile Number | text input | placeholder "Mobile Number" |
| Field: Select Treatment | dropdown | "Select Treatment" |
| Field: Preferred Date | date picker | "Preferred Time" (with calendar icon) |
| Field: Preferred Time | dropdown | "Preferred Time" |
| Submit | button | "Book Appointment" |
| Visual | image | Gift box "EXCLUSIVE BENEFITS" |

### 0.4 Newsletter band (recurring on inner pages)

| Data Point | Type | Example |
|------------|------|---------|
| Heading | text | "Get exclusive offer & med spa tips" |
| Sub-copy | text | "Join with thousand of subscribers!" |
| Field: Email | email input | placeholder "Enter your email address" |
| Submit | button | "Subscibe" *(sic — typo in mockup)* |
| Visual | image | Row of client faces |

### 0.5 Footer

| Data Point | Type | Example |
|------------|------|---------|
| Column 1 links | links | FIND A MEDSPA · TREATMENTS A-Z · CONDITIONS · BEST OF 2026 |
| Column 2 links | links | GET A FREE LISTINGS · I'M A G99 CLIENT · FEATURED PLANS · FOR PROVIDERS |
| Newsletter | text + input + button | "Subscribe to our newsletter and for important news and Updates" · Email field · "GO" |
| Social icons | icons | Instagram, Facebook |
| Legal line | text | "MEDSPA MAPS © 2026. ALL RIGHTS RESERVED. PRIVACY POLICY \| TERMS & CONDITION" |
| Attribution | text + logo | "SITE DESIGNED & MAINTAINED BY: Growth99" |

---

## 1. Home / Landing Page (`Medspa Home - Final.png`)

### 1.1 Hero + Search

| Section | Data Point | Type | Example |
|---------|-----------|------|---------|
| Hero | Eyebrow badge | pill | "TRUSTED MEDSPA DIRECTORY + PATIENT EDUCATION" |
| Hero | Sub-copy | text | "Explore 10,000+ vetted medspas, read expert treatment guides, and book with confidence. The most trusted resource for aesthetic medicine patients." |
| Hero | Headline | text | "Find the *Right Medspa* & Treatment — Near You" |
| Search | Services field | search input | label "SERVICES", placeholder "Search treatment, condition or services…" |
| Search | Location field | search input | label "LOCATION", placeholder "City, Zip or 'Near Me'" |
| Search | Submit | button | "Search" |
| Trust row | Trust badges | list | "10,000+ Verified Listings" · "Expert-Reviewed Content" · "2026 Award Winners" · "No Pay-to-Rank" |
| Social proof | Avatar cluster + rating | images + number | 5 client avatars · "4.9 ★★★★★" · "500+ Happy Clients" |

### 1.2 Treatment quick-chips (carousel under hero)

| Data Point | Type | Example |
|-----------|------|---------|
| Chip (icon + label) | list, scrollable | Chemical Peel · Microneedling · Botox · Body Recounting · Fillers · Laser · Skin Rejuvenation (← → arrows) |

### 1.3 Trust stats — "Trusted by Thousands. Loved Everywhere."

| Stat | Value | Label |
|------|-------|-------|
| Verified clinics | 12,500+ | VERIFIED CLINICS |
| Cities | 750+ | CITIES COVERED |
| States | 48 | STATES REPRESENTED |
| Rating | 4.9 | AVERAGE RATING |
| Visitors | 185,000+ | MONTHLY VISITORS |

### 1.4 Popular Treatments (carousel)

Each card = **Treatment** entity → `{ icon, name, clinic_count }` *(clinic_count is derived; price removed)*

| Treatment | Clinics |
|-----------|---------|
| Fillers | 842 clinics |
| Botox | 1254 clinics |
| Laser | 536 clinics |
| Microneedling | 368 clinics |
| Chemical Peel | 788 clinics |
| Skin Resurfacing | 218 clinics |
| IV Therapy | 524 clinics |
| Body Countring | 189 clinics |

### 1.5 "Find the Perfect Clinic" (filterable clinic carousel)

| Section | Data Point | Type | Example |
|---------|-----------|------|---------|
| Filter bar | Treatments | dropdown | "Treatments" |
| Filter bar | Distance | dropdown | "25 Miles Away" |
| Filter bar | Rating | dropdown | "4.0+ and More Rating" |
| Filter bar | Clear Filters | link | "Clear Filters" |
| Filter bar | Apply Filters | button | "Apply Filters" |
| Clinic card | Featured badge | badge | "FEATURED" |
| Clinic card | Favorite | icon toggle | heart |
| Clinic card | Media | image + video | play button overlay |
| Clinic card | Logo | image | "TA" |
| Clinic card | Name + verified | text + badge | "Timeless Aesthetics" ✔ |
| Clinic card | Location | text + pin | "Austin, TX" · "8.5 Miles Away" |
| Clinic card | Rating | stars + count | "4.8 ★★★★★ (68)" |
| Clinic card | Gallery thumbs | images | 3 thumbs + "+18" |
| Clinic card | Treatment tags | chips | Botox · Fillers · Laser · Skin · IV Therapy |
| Clinic card | View Profile | button | "View Profile" |
| Clinic card | Book | button | "Book Now" |

### 1.6 Providers Spotlight (carousel)

| Section | Data Point | Type | Example |
|---------|-----------|------|---------|
| Header | Section link | link | "View All Providers →" |
| Provider card | Photo | image | headshot |
| Provider card | Name + verified | text + badge | "Dr. Larissa Joe" ✔ |
| Provider card | Title | text | "Injectable Specialist" |
| Provider card | Experience | text | "10+ YEARS OF EXPERIENCE" |
| Provider card | Bio snippet | text | "Expert in Botox, fillers and laser treatments. Provides soft and natural looking results." |
| Provider card | Customer Rating | number | "Customer Rating ★ 4.9" |
| Provider card | CTA | button | "View Profile" |

### 1.7 "How It Works?"

| Step | Label | Copy |
|------|-------|------|
| 1 | SEARCH | "Find treatments & clinic near you!" |
| 2 | COMPARE | "Compare prices revives & results." ⚠️ *copy references pricing — reword now that pricing is removed* |
| 3 | BOOK | "Book your appointment online." |
| 4 | ENJOY | "Love your results and feel confident." |

### 1.8 "Get Your medSpa listed" + "Claim Your Benefits" (provider lead-gen)

| Section | Data Point | Type | Example |
|---------|-----------|------|---------|
| Left | Heading | text | "Get Your medSpa listed & Get More Clients!" |
| Left | Sub-copy | text | "List your clinic today and get a chance to be featured on our homepage!" |
| Left | Benefit 1 | icon + text | "Free Premium Listing — For first 100 signups" |
| Left | Benefit 2 | icon + text | "Featured on Homepage — Get maximum velocity" |
| Left | Benefit 3 | icon + text | "Priority Support — Dedicated account manager" |
| Right | Heading | text | "Claim Your Benefits" · "Unlimited time offer!" |
| Right | Countdown | timer | 02 Days · 14 hours · 36 Min · 28 Sec |
| Right | Field: Full Name | input | "Full Name" |
| Right | Field: Business Email | input | "Business Email" |
| Right | Field: Business Name | input | "Business Name" |
| Right | Submit | button | "Claim Your Benefits!" |

### 1.9 Top Cities

| Data Point | Type | Example |
|-----------|------|---------|
| Section link | link | "View All →" |
| City chips | list | Los Angeles · Miami · New York · Dallas · Chicago · Illinois · Georgia |

### 1.10 Resources — "Your Resource for Expert MedSpa knowledge!"

| Section | Data Point | Type | Example |
|---------|-----------|------|---------|
| Intro | Copy | text | "In-depth guide, expert tips and the latest insight to help you make informed decisions." |
| Intro | Article search | input | "Search articles, topics, treatments…" |
| Intro | Popular Topics | chips (tags) | Botox · Fillers · Laser Treatments · Acne · Anti Aging |
| Category card | name + count | list | Treatments (24 Articles) · Skin Care (15) · Wellness (56) · Business Tips (22) · Patient Guide (15) |
| Latest Articles | Section link | link | "View All Articles →" |
| Article card | category | tag | "TREATMENTS" |
| Article card | title | text | "Benefits of Laser Hair Treatments" |
| Article card | meta | text | "May 12, 2026 · 5 min read" |
| Article card | thumbnail | image | |

*(Home closes with the Newsletter band §0.4 and Footer §0.5. Note: Home has **no** "What our Client Says" section — reviews are Clinic-page only.)*

---

## 2. Search Results Page (`Medspa - Search Results Page.png`)

### 2.1 Search header

| Data Point | Type | Example |
|-----------|------|---------|
| Title | text | "Botox *Near Miami*" (treatment + location) |
| Treatment field | dropdown | "Botox" |
| Location/Distance field | dropdown | "25 Miles Away" |
| Search | button | "Search" |
| Result count | text | "48 Providers Found" |
| Sort control | dropdown | "Sorted By: Distance" |

### 2.2 Filters sidebar

| Filter group | Options | Default checked |
|--------------|---------|-----------------|
| **Treatment Type** | Botox, Fillers, Laser, Microneedling, Chemical Peel, Skin Rejuvenation, IV Therapy | Botox ✔ |
| **Distance / Radius** | 10-20 Miles, 20-40 Miles, 40-80 Miles, 80-120 Miles | 10-20 Miles ✔ |
| **Rating** | 4.5+, 4.0+, 5.0+ | 4.5+ ✔ |
| **Provider Type** | Nurse Practitioner, MD, Plastic Surgeon, Dermatologist | Nurse Practitioner ✔ |
| **Availability** | Open Today, Weekend Availability | — |
| Controls | "Clear All" (top), "Clear All Filters" (button, bottom) | — |

### 2.3 Clinic result card (repeats per result)

| Data Point | Type | Example |
|-----------|------|---------|
| Tier badge | badge | "FEATURED" / "CUSTOMER FAVORITE" |
| Hero image + gallery | images | main + 3 thumbs + "+18" |
| Name + verified | text + badge | "Timeless Aesthetics" ✔ |
| Location | text + pin | "Austin, TX" · "8.5 Miles Away" |
| Rating | stars + count | "4.8 ★★★★★ (68)" |
| Treatment tags | chips | Botox · Fillers · Laser Treatments *(varies: Anti Aging · Fillers · PRP / Sculptra · Hair Transplant · Acne & Scars)* |
| Highlights | checklist | Natural Looking Results · 15+ Years Of Experience · Award Winning Team · Highly Rated On Google |
| CTA primary | button | "Book Appointment" |
| CTA secondary | button | "Call Clinic ☎" |
| Pagination | control | ← 1 2 3 4 5 → |

*(Then "Book Your Appointment" §0.3, Newsletter §0.4, Footer §0.5. No reviews section.)*

---

## 3. Clinic Individual Page (`Medspa - Clinic Individual.png`) — **the only page with reviews**

### 3.1 Clinic header

| Data Point | Type | Example |
|-----------|------|---------|
| Logo | image | RUMA Medical mark |
| Tier badge | badge | "FEATURED PREMIUM CLINIC" |
| Name | text | "RUMA Medical" |
| Description | text | "Specialized Facial Aesthetics: At RUMA we provide the highest quality cosmetic and aesthetic injectables including Botox/Dysport, Filler, Kybella, Sculptra, PRP/PRF, and PDO threading." |
| Address | text + pin | "1850 W Ashton Blvd, Ste 100, Lehi, UT 84043" |
| Open status + hours | text + clock | "Open Today · 10AM - 7PM" |
| Rating | stars + count | "5.0 (498 Reviews)" |
| Media | image + video | reception photo w/ play button |
| Gallery | thumbnails | 3 thumbs + "+12 View All" |
| CTA primary | button | "Book Appointment" |
| CTA secondary | button | "Call Clinic ☎" |

### 3.2 "Treatment Offered By RUMA" (carousel)

Each = Treatment `{ icon, name }` *(price removed)*: Fillers · Botox · Laser · Microneedling · Chemical Peel · Skin Resurfacing · IV Therapy · Body Countring

### 3.3 "About RUMA Clinic, Lehi, UT"

| Data Point | Type | Example |
|-----------|------|---------|
| Body copy | rich text (multi-paragraph) | Founder story + philosophy (mentions "Shelby Miller, DNP, FNP-C, founded RUMA in 2018 …") |

### 3.4 Clinic vanity stats

| Stat | Value | Label |
|------|-------|-------|
| Experts | 20+ | CERTIFIED EXPERT |
| Cities | 8 | CITIES COVERED |
| Treatments | 50+ | ADVANCED TREATMENT |
| Rating | 5.0 | AVERAGE RATING |
| Patients | 10k+ | PATIENT TRANSFORMED |
| CTAs | — | "Book Appointment" · "Call Clinic" |

### 3.5 "Meet RUMA Experts" (provider carousel)

| Data Point | Type | Example |
|-----------|------|---------|
| Photo | image | headshot |
| Name + verified | text + badge | "Dr. Larissa Joe" / "Dr. Shane Watson" ✔ |
| Title | text | "Injectable Specialist" |
| CTAs | buttons | "Book Appointment" · "Call Clinic" |

### 3.6 "What our Client Says" ✅ *(reviews live here only)*

| Data Point | Type | Example |
|-----------|------|---------|
| Section link / carousel | control | ← → |
| Rating | stars | ★★★★★ |
| Body | text | review body |
| Author | text | "- Jessica R." |

*(Then "Book Your Appointment" §0.3, Newsletter §0.4, Footer §0.5.)*

---

## 4. Treatment / Service Individual Page (`Medspa - Service Individual Page.png`)

### 4.1 Treatment hero

| Data Point | Type | Example |
|-----------|------|---------|
| Title | text | "Botox *Treatment*" |
| Description | text | "Botox is a non-surgical injectable treatment that temporarily relaxes targeted facial muscles to reduce the appearance of fine lines and wrinkles. It is commonly used to treat forehead lines, frown lines, and crow's feet while helping maintain a natural, refreshed appearance." |
| Fact: Treatment Time | icon + label + value | "TREATMENT TIME · 20-30 mins" |
| Fact: Results | icon + label + value | "RESULTS · Within 1 day" |
| Fact: Duration | icon + label + value | "DURATION · 4-6 Months" |
| Hero image | image | treatment photo |

*(Rating pill and price removed from the hero.)*

### 4.2 "Best Clinics Near You"

| Data Point | Type | Example |
|-----------|------|---------|
| Count | text | "48 Clinics Found" |
| Sort | dropdown | "Sorted By: Distance" |
| Clinic card: badge | badge | "FEATURED" |
| Clinic card: image + gallery | images | main + thumbs + "+18" |
| Clinic card: name + verified | text + badge | "Lumière Med Spa" / "Renewal MD Center" / "The Skin Studio" ✔ |
| Clinic card: rating | stars + count | "4.8 ★ (68)" |
| Clinic card: CTA | button | "Book Appointment" |
| Pagination | control | ← 1 2 3 4 5 → |

### 4.3 "Top Providers In Miami"

| Data Point | Type | Example |
|-----------|------|---------|
| Count | text | "27 Providers Found" |
| Sort | dropdown | "Sorted By: Distance" |
| Provider card: photo | image | headshot |
| Provider card: name + verified | text + badge | "Dr. Larissa Joe" ✔ |
| Provider card: title | text | "Injectable Specialist" |
| Provider card: experience | text | "10+ YEARS OF EXPERIENCE" |
| Provider card: bio | text | "Expert in Botox, fillers and laser treatments. Provides soft and natural looking results." |
| Provider card: rating | number | "Customer Rating ★ 4.9" |
| Provider card: CTA | button | "View Profile" |
| Pagination | control | ← 1 2 3 4 5 → |

*(Then "Book Your Appointment" §0.3, Newsletter §0.4, Footer §0.5. No reviews section.)*

---

## 5. Provider Individual Page (`Medspa - Provider Individual.png`)

### 5.1 Provider header

| Data Point | Type | Example |
|-----------|------|---------|
| Photo | image | headshot |
| Name + verified | text + badge | "Dr. Larissa Joe" ✔ |
| Title | text | "Injectable Specialist" |
| Clinic + location | text | "RUMA Medical · Lehi, UT" |
| Clinic logo | image | RUMA Medical |
| Bio | text | "Dr. Larissa Joe is a board-certified Nurse Practitioner specializing in facial aesthetics and injectable treatments. With a passion for natural results and patient education, she believes in enhancing your beauty while maintaining what makes you uniquely you." |
| Highlight chips | list (icon + label) | Board Certified Nurse Practitioner · Expert in Facial Aesthetics · Natural Looking Results · Patient-Centered Care |
| Rating | number | "5.0" (display value; no review records on providers) |
| Experience | text | "10+ Years Experience" |
| CTA primary | button | "Book Appointment" |
| CTA secondary | button | "Call Clinic ☎" |

### 5.2 Credentials & Education

Each = `{ credential, institution }`:

| Credential | Institution |
|-----------|-------------|
| Board-Certified Nurse Practitioner | American Nurses Credentialing Center (ANCC) |
| Master of Science in Nursing (MSN) | University of Utah |
| Bachelor of Science in Nursing (BSN) | Brigham Young University |
| Advanced Training in Aesthetics | Allergan Medical Institute & Galderma Aesthetics |
| Member | American Association of Nurse Practitioners (AANP) |

### 5.3 Specialties

Each = `{ icon, name, description }`:

| Specialty | Description |
|-----------|-------------|
| Injectables | "Botox Dysport, Xeomin, and dermal fillers for natural-looking results." |
| Facial Rejuvenation | "Comprehensive approaches to smooth fine lines and restore youthful contours." |
| Skin Health | "Medical-grade skincare and treatments to improve overall skin quality." |
| Preventative Aesthetics | "Personalized treatment plans to help you age gracefully and confidently." |

### 5.4 "Treatment Offered By Dr. larissa Joe"

Carousel of Treatment `{ icon, name }` *(price removed)*: Fillers · Botox · Laser · Microneedling · Chemical Peel · Skin Resurfacing · IV Therapy · Body Countring

### 5.5 "Other providers from RUMA"

| Data Point | Type | Example |
|-----------|------|---------|
| Photo | image | headshot |
| Name + verified | text + badge | "Dr. Larissa Joe" / "Dr. Shane Watson" ✔ |
| Title | text | "Injectable Specialist" |
| CTAs | buttons | "Book Appointment" · "Call Clinic" |

*(Then "Book Your Appointment" §0.3, Newsletter §0.4, Footer §0.5. **Before & After Results section removed. No reviews section.**)*

---

## 6. Concern Page (`Concern Page 1/2/3.png` — one page, three tabs)

**Shared header (all tabs):**

| Data Point | Type | Example |
|-----------|------|---------|
| Breadcrumb | path | "Home › Concerns" |
| Title | text | "Fine Lines & Wrinkles" (Concern name) |
| CTA | button | "Book Appointment" |
| Tabs | tab control | **Overview** · **Clinics & Diagnosis** · **Doctors & Providers** |

### 6.1 Tab: Overview (`Concern Page 1`)

| Section | Data Point | Type | Example |
|---------|-----------|------|---------|
| "What are Wrinkles?" | Block: Signs of Aging | heading + text | "Commonly appear as forehead lines, crow's feet, smile lines, and fine creases caused by repeated facial movements and natural collagen loss." |
| | Block: Causes of Wrinkles | heading + text | "Aging, sun exposure, genetics, lifestyle habits, and reduced collagen production can all contribute to the development of fine lines and wrinkles." |
| | Block: Who Is a Candidate? | heading + text | "Adults looking to soften visible signs of aging, prevent deeper wrinkle formation, or maintain a refreshed, natural appearance." |
| | Block: Expected Results | heading + text | "Many patients notice smoother, younger-looking skin with treatments designed to reduce wrinkles while preserving natural facial expressions." |
| Info cards (right) | Common Treatment Areas | card | "Forehead lines, frown lines, crow's feet, lip lines, neck lines, and areas with visible skin texture concerns." |
| | Injectable Treatments | card | "Botox®, Dysport®, Xeomin®, and dermal fillers help soften dynamic wrinkles and restore youthful facial balance." |
| | Benefits | card | "Treatments that support natural collagen production can help improve firmness, elasticity, and long-term skin health." |
| | Preventative Aging Care | card | "Personalized treatment plans help slow visible signs of aging and maintain healthy, radiant skin over time." |

*(Before & After Results and What our Client Says sections removed from this tab.)*

### 6.2 Tab: Clinics & Diagnosis (`Concern Page 2`)

| Section | Data Point | Type | Example |
|---------|-----------|------|---------|
| "Best Clinics Near You" | Count | text | "48 Clinics Found" |
| | Sort | dropdown | "Sorted By: Distance" |
| | Clinic card: badge | badge | "FEATURED" |
| | Clinic card: image + gallery | images | main + thumbs + "+18" |
| | Clinic card: name + verified | text + badge | "Lumière Med Spa" / "Renewal MD Center" / "The Skin Studio" ✔ |
| | Clinic card: rating | stars + count | "4.8 ★ (68)" |
| | Clinic card: CTA | button | "Book Appointment" |
| | Pagination | control | ← 1 2 3 4 5 → |

*(Before & After Results and What our Client Says sections removed from this tab.)*

### 6.3 Tab: Doctors & Providers (`Concern Page 3`)

| Section | Data Point | Type | Example |
|---------|-----------|------|---------|
| "Best Clinics Near You" *(provider cards)* | Count | text | "48 Clinics Found" |
| | Sort | dropdown | "Sorted By: Distance" |
| | Provider card: photo | image | headshot |
| | Provider card: name + verified | text + badge | "Dr. Larissa Joe" ✔ |
| | Provider card: title | text | "Injectable Specialist" |
| | Provider card: experience | text | "10+ YEARS OF EXPERIENCE" |
| | Provider card: bio | text | "Expert in Botox, fillers and laser treatments. Provides soft and natural looking results." |
| | Provider card: rating | number | "Customer Rating ★ 4.9" |
| | Provider card: CTA | button | "View Profile" |
| | Pagination | control | ← 1 2 3 4 5 → |

*(Before & After Results and What our Client Says sections removed from this tab.)*

*(All three tabs close with "Book Your Appointment" §0.3, Newsletter §0.4, Footer §0.5.)*

---

## 7. Cross-page correlation summary

Which entity feeds which screen (✅ = primary source, ○ = referenced/embedded):

| Entity | Home | Search | Clinic | Treatment | Provider | Concern |
|--------|:----:|:------:|:------:|:---------:|:--------:|:-------:|
| Clinic / MedSpa | ○ | ✅ | ✅ | ○ | ○ | ○ |
| Provider / Doctor | ○ | — | ○ | ○ | ✅ | ○ |
| Treatment / Service | ○ | ○ (filter) | ○ | ✅ | ○ | ○ |
| Concern / Condition | ○ (search) | — | — | — | — | ✅ |
| Review / Testimonial | — | — | ✅ | — | — | — |
| Article / Resource | ✅ | — | — | — | — | — |
| City | ✅ | ○ | ○ | ○ | ○ | ○ |
| Lead / Form submission | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Recurring shared components
- **Header nav + Footer** → every page.
- **"Book Your Appointment" CTA band** → every inner page (Search, Clinic, Treatment, Provider, all Concern tabs). Home uses the "Claim Your Benefits" variant instead.
- **"What our Client Says" testimonials** → **Clinic page only**.
- **Newsletter band** → every page.
- **Verified badge**, **aggregate rating (stars + count)**, **Featured/Premium/Customer-Favorite tiers**, **treatment tag chips** (derived from a clinic's offered treatments), and **distance ("X Miles Away")** are consistent atoms reused across Clinic and Provider cards everywhere.

---

### Notes & observations from the mockups
- **Removed per scope:** all pricing ("Starting at/from $X", "$X/Unit"), all promo/discount badges ("15% OFF", "10% OFF + 5% OFF…"), all Before & After Results sections + entity, and the "What our Client Says" review section on every page except Clinic.
- Copy contains typos to fix in build: **"Subscibe"** (→ *Subscribe*), **"Body Countring / Body Recounting"** (→ *Body Contouring*), **"Compare prices revives"** (→ reword; also drop the pricing reference), **"Dr. larissa Joe"** (inconsistent capitalisation).
- Clinic tiers seen: **Featured**, **Featured Premium Clinic**, **Customer Favorite** — implies a `tier` enum on Clinic.
- **Aggregate rating** (`avg_rating` + `review_count`) remains an intrinsic clinic attribute shown on clinic cards everywhere; only the review *content* (the testimonial cards) is confined to the Clinic page. Provider rating is a plain profile stat, not backed by review records.
- The three Concern images are **tab states of a single page**, sharing header/title/tabs and differing only in the middle content block.
