/**
 * seed-data.ts — run with: bun scripts/seed-data.ts
 *
 * Populates the database with realistic dummy data for MedSpa Maps.
 * All cities/states are real US locations.
 *
 * Creates:
 *   - 12 businesses
 *   - 20 clinics across major US cities
 *   - 24 providers
 *   - 8 categories
 *   - 20 services
 *   - junction records (clinic_providers, service_categories, clinic_services, concern_services)
 *   - ~60 reviews
 *   - 10 concerns
 *   - images for clinics & providers
 *   - 3 listing claims
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Data ─────────────────────────────────────────────────────────────────────

const businesses = [
  { name: "Glow Aesthetics Group", slug: "glow-aesthetics-group", website_url: "https://glowaesthetics.com", phone: "(305) 555-0101", email: "info@glowaesthetics.com", city: "Miami", state: "FL", tier: "elite", verified: true, about: "Miami's premier medical aesthetics group, offering luxury injectable and laser treatments across South Florida since 2015." },
  { name: "Radiance MedSpa", slug: "radiance-medspa", website_url: "https://radiancemedspa.com", phone: "(212) 555-0202", email: "hello@radiancemedspa.com", city: "New York", state: "NY", tier: "featured", verified: true, about: "Award-winning medspa in the heart of Manhattan specializing in non-surgical facial rejuvenation and body contouring." },
  { name: "Pacific Skin Institute", slug: "pacific-skin-institute", website_url: "https://pacificskin.com", phone: "(310) 555-0303", email: "contact@pacificskin.com", city: "Los Angeles", state: "CA", tier: "elite", verified: true, about: "Board-certified dermatologists and aesthetic specialists providing cutting-edge skincare treatments in Beverly Hills." },
  { name: "Luxe Derma Clinic", slug: "luxe-derma-clinic", website_url: "https://luxederma.com", phone: "(512) 555-0404", email: "info@luxederma.com", city: "Austin", state: "TX", tier: "featured", verified: true, about: "Austin's trusted destination for medical-grade skin treatments, injectables, and wellness therapies." },
  { name: "Bella Vita Aesthetics", slug: "bella-vita-aesthetics", website_url: "https://bellavitaaesthetics.com", phone: "(480) 555-0505", email: "info@bellavita.com", city: "Scottsdale", state: "AZ", tier: "elite", verified: true, about: "Scottsdale's most sought-after aesthetic practice, combining artistry with medical precision for natural-looking results." },
  { name: "Revive Wellness Spa", slug: "revive-wellness-spa", website_url: "https://revivewellness.com", phone: "(404) 555-0606", email: "hello@revivewellness.com", city: "Atlanta", state: "GA", tier: "free", verified: false, about: "Holistic wellness and aesthetic treatments in Buckhead, focusing on whole-body rejuvenation." },
  { name: "Pristine Skin Center", slug: "pristine-skin-center", website_url: "https://pristineskin.com", phone: "(312) 555-0707", email: "info@pristineskin.com", city: "Chicago", state: "IL", tier: "featured", verified: true, about: "Gold Coast's leading skin center with a team of fellowship-trained cosmetic dermatologists." },
  { name: "Zenith Medical Aesthetics", slug: "zenith-medical-aesthetics", website_url: "https://zenithmedspa.com", phone: "(415) 555-0808", email: "contact@zenithmedspa.com", city: "San Francisco", state: "CA", tier: "free", verified: false, about: "Innovative aesthetic medicine practice in Union Square, specializing in regenerative treatments." },
  { name: "Haus of Beauty MedSpa", slug: "haus-of-beauty-medspa", website_url: "https://hausofbeauty.com", phone: "(702) 555-0909", email: "info@hausofbeauty.com", city: "Las Vegas", state: "NV", tier: "featured", verified: true, about: "Vegas-style glamour meets medical expertise. Full-service medspa on the Strip." },
  { name: "Serenity Skin Lab", slug: "serenity-skin-lab", website_url: "https://serenityskinlab.com", phone: "(615) 555-1010", email: "hello@serenityskinlab.com", city: "Nashville", state: "TN", tier: "free", verified: false, about: "Nashville's boutique skin lab offering personalized aesthetic treatments in a serene environment." },
  { name: "Elite Aesthetic Partners", slug: "elite-aesthetic-partners", website_url: "https://eliteaesthetic.com", phone: "(214) 555-1111", email: "info@eliteaesthetic.com", city: "Dallas", state: "TX", tier: "elite", verified: true, about: "Multi-location aesthetic practice serving the Dallas-Fort Worth metroplex with premium injectable and laser services." },
  { name: "Coastal Glow MedSpa", slug: "coastal-glow-medspa", website_url: "https://coastalglow.com", phone: "(858) 555-1212", email: "info@coastalglow.com", city: "San Diego", state: "CA", tier: "free", verified: false, about: "Laid-back luxury medspa in La Jolla offering sun-damage repair and anti-aging treatments." },
];

const clinics = [
  // Glow Aesthetics Group — 2 locations
  { bizIdx: 0, name: "Glow Aesthetics — South Beach", slug: "south-beach", address: "1234 Ocean Dr, Suite 200", city: "Miami Beach", state: "FL", zip: "33139", lat: 25.7826, lng: -80.1341, phone: "(305) 555-0111", tier: "elite", verified: true, featured: true, about: "Our flagship South Beach location offers panoramic ocean views and the latest in aesthetic technology." },
  { bizIdx: 0, name: "Glow Aesthetics — Coral Gables", slug: "coral-gables", address: "456 Miracle Mile", city: "Coral Gables", state: "FL", zip: "33134", lat: 25.7494, lng: -80.2588, phone: "(305) 555-0112", tier: "elite", verified: true, featured: true, about: "Elegant Coral Gables location nestled in the heart of Miracle Mile shopping district." },
  // Radiance MedSpa — 2 locations
  { bizIdx: 1, name: "Radiance MedSpa — Midtown", slug: "midtown", address: "500 5th Ave, Floor 12", city: "New York", state: "NY", zip: "10110", lat: 40.7537, lng: -73.9817, phone: "(212) 555-0211", tier: "featured", verified: true, featured: true, about: "Midtown Manhattan's most exclusive medspa, steps from Rockefeller Center." },
  { bizIdx: 1, name: "Radiance MedSpa — Upper East Side", slug: "upper-east-side", address: "1200 Madison Ave", city: "New York", state: "NY", zip: "10128", lat: 40.7831, lng: -73.9575, phone: "(212) 555-0212", tier: "featured", verified: true, featured: false, about: "Intimate Upper East Side boutique specializing in subtle, natural enhancements." },
  // Pacific Skin Institute — 2 locations
  { bizIdx: 2, name: "Pacific Skin — Beverly Hills", slug: "beverly-hills", address: "9876 Wilshire Blvd, Suite 300", city: "Beverly Hills", state: "CA", zip: "90210", lat: 34.0652, lng: -118.3961, phone: "(310) 555-0311", tier: "elite", verified: true, featured: true, about: "Celebrity-favorite Beverly Hills clinic with state-of-the-art treatment suites." },
  { bizIdx: 2, name: "Pacific Skin — Santa Monica", slug: "santa-monica", address: "2501 Ocean Ave", city: "Santa Monica", state: "CA", zip: "90405", lat: 34.0054, lng: -118.4910, phone: "(310) 555-0312", tier: "elite", verified: true, featured: false, about: "Beachside aesthetic clinic combining medical excellence with California wellness." },
  // Luxe Derma Clinic — 1 location
  { bizIdx: 3, name: "Luxe Derma Clinic — Downtown Austin", slug: "downtown-austin", address: "600 Congress Ave, Suite 400", city: "Austin", state: "TX", zip: "78701", lat: 30.2672, lng: -97.7431, phone: "(512) 555-0411", tier: "featured", verified: true, featured: true, about: "Downtown Austin's premier dermatology and aesthetics destination on historic Congress Avenue." },
  // Bella Vita Aesthetics — 2 locations
  { bizIdx: 4, name: "Bella Vita — Old Town Scottsdale", slug: "old-town-scottsdale", address: "7150 E 5th Ave", city: "Scottsdale", state: "AZ", zip: "85251", lat: 33.4942, lng: -111.9261, phone: "(480) 555-0511", tier: "elite", verified: true, featured: true, about: "Our original Old Town location, known for artful injectable techniques and desert-inspired wellness." },
  { bizIdx: 4, name: "Bella Vita — North Scottsdale", slug: "north-scottsdale", address: "15440 N Tatum Blvd", city: "Scottsdale", state: "AZ", zip: "85032", lat: 33.6105, lng: -111.9758, phone: "(480) 555-0512", tier: "elite", verified: true, featured: false, about: "Spacious North Scottsdale facility with dedicated laser suites and private treatment rooms." },
  // Revive Wellness Spa — 1 location
  { bizIdx: 5, name: "Revive Wellness Spa — Buckhead", slug: "buckhead", address: "3500 Peachtree Rd NE", city: "Atlanta", state: "GA", zip: "30326", lat: 33.8459, lng: -84.3621, phone: "(404) 555-0611", tier: "free", verified: false, featured: false, about: "Buckhead's holistic approach to beauty, blending medical aesthetics with integrative wellness." },
  // Pristine Skin Center — 2 locations
  { bizIdx: 6, name: "Pristine Skin — Gold Coast", slug: "gold-coast", address: "1000 N State St", city: "Chicago", state: "IL", zip: "60610", lat: 41.9015, lng: -87.6282, phone: "(312) 555-0711", tier: "featured", verified: true, featured: true, about: "Chicago Gold Coast landmark clinic with over 20 years of aesthetic excellence." },
  { bizIdx: 6, name: "Pristine Skin — Lincoln Park", slug: "lincoln-park", address: "2345 N Clark St", city: "Chicago", state: "IL", zip: "60614", lat: 41.9267, lng: -87.6431, phone: "(312) 555-0712", tier: "featured", verified: true, featured: false, about: "Relaxed Lincoln Park location popular with young professionals seeking preventive treatments." },
  // Zenith Medical Aesthetics — 1 location
  { bizIdx: 7, name: "Zenith Medical — Union Square", slug: "union-square", address: "345 Stockton St, Floor 8", city: "San Francisco", state: "CA", zip: "94108", lat: 37.7870, lng: -122.4061, phone: "(415) 555-0811", tier: "free", verified: false, featured: false, about: "Innovative San Francisco practice pioneering regenerative aesthetics in the Bay Area." },
  // Haus of Beauty MedSpa — 1 location
  { bizIdx: 8, name: "Haus of Beauty — The Strip", slug: "the-strip", address: "3700 S Las Vegas Blvd", city: "Las Vegas", state: "NV", zip: "89109", lat: 36.1147, lng: -115.1728, phone: "(702) 555-0911", tier: "featured", verified: true, featured: true, about: "Glamorous Strip-adjacent medspa catering to locals and visitors seeking red-carpet-ready results." },
  // Serenity Skin Lab — 1 location
  { bizIdx: 9, name: "Serenity Skin Lab — The Gulch", slug: "the-gulch", address: "500 12th Ave S", city: "Nashville", state: "TN", zip: "37203", lat: 36.1510, lng: -86.7891, phone: "(615) 555-1011", tier: "free", verified: false, featured: false, about: "Nashville's trendy Gulch neighborhood home to personalized skin treatments and IV therapy." },
  // Elite Aesthetic Partners — 2 locations
  { bizIdx: 10, name: "Elite Aesthetic — Uptown Dallas", slug: "uptown-dallas", address: "2700 McKinney Ave", city: "Dallas", state: "TX", zip: "75204", lat: 32.8000, lng: -96.8005, phone: "(214) 555-1111", tier: "elite", verified: true, featured: true, about: "Uptown Dallas flagship offering VIP treatment experiences and concierge aesthetic medicine." },
  { bizIdx: 10, name: "Elite Aesthetic — Fort Worth", slug: "fort-worth", address: "800 Main St", city: "Fort Worth", state: "TX", zip: "76102", lat: 32.7555, lng: -97.3308, phone: "(817) 555-1112", tier: "elite", verified: true, featured: false, about: "Fort Worth's premier aesthetic clinic in the historic Sundance Square district." },
  // Coastal Glow MedSpa — 2 locations
  { bizIdx: 11, name: "Coastal Glow — La Jolla", slug: "la-jolla", address: "7734 Girard Ave", city: "La Jolla", state: "CA", zip: "92037", lat: 32.8449, lng: -117.2740, phone: "(858) 555-1211", tier: "free", verified: false, featured: false, about: "Charming La Jolla village clinic specializing in sun damage repair and coastal-inspired wellness." },
  { bizIdx: 11, name: "Coastal Glow — Del Mar", slug: "del-mar", address: "1555 Camino Del Mar", city: "Del Mar", state: "CA", zip: "92014", lat: 32.9595, lng: -117.2653, phone: "(858) 555-1212", tier: "free", verified: false, featured: false, about: "Beachfront Del Mar location offering relaxed aesthetic treatments with ocean views." },
];

const categories = [
  { name: "Injectables", slug: "injectables", description: "Neurotoxins, dermal fillers, and other injectable treatments for facial rejuvenation.", display_order: 1 },
  { name: "Laser Treatments", slug: "laser-treatments", description: "Laser resurfacing, hair removal, tattoo removal, and skin tightening using advanced laser technology.", display_order: 2 },
  { name: "Body Contouring", slug: "body-contouring", description: "Non-surgical fat reduction and body sculpting treatments.", display_order: 3 },
  { name: "Skin Rejuvenation", slug: "skin-rejuvenation", description: "Chemical peels, microneedling, and treatments to restore youthful, glowing skin.", display_order: 4 },
  { name: "Facial Treatments", slug: "facial-treatments", description: "Medical-grade facials, HydraFacials, and advanced skincare protocols.", display_order: 5 },
  { name: "Wellness & IV Therapy", slug: "wellness-iv-therapy", description: "IV vitamin drips, hormone therapy, and integrative wellness treatments.", display_order: 6 },
  { name: "Hair Restoration", slug: "hair-restoration", description: "PRP hair treatments, scalp micropigmentation, and medical hair loss solutions.", display_order: 7 },
  { name: "Skin Tightening", slug: "skin-tightening", description: "Radiofrequency, ultrasound, and energy-based treatments for firmer, tighter skin.", display_order: 8 },
];

const services = [
  // Injectables
  { name: "Botox", slug: "botox", catIdx: 0, alias: ["Neuromodulator", "Botulinum Toxin"], summary: "The gold standard in wrinkle relaxation.", what_it_is: "Botox is an FDA-approved injectable neurotoxin that temporarily relaxes facial muscles to smooth fine lines and wrinkles.", how_it_works: "Small amounts of botulinum toxin are injected into targeted facial muscles, blocking nerve signals that cause contractions.", cost_low: 200, cost_high: 600, recovery: "None", duration: 15 },
  { name: "Dermal Fillers", slug: "dermal-fillers", catIdx: 0, alias: ["Juvederm", "Restylane", "Filler"], summary: "Restore volume and sculpt facial contours.", what_it_is: "Hyaluronic acid-based gels injected beneath the skin to restore volume, smooth wrinkles, and enhance facial features.", how_it_works: "HA fillers attract and bind water molecules, creating natural-looking volume in areas like cheeks, lips, and jawline.", cost_low: 500, cost_high: 1500, recovery: "1-2 days mild swelling", duration: 30 },
  { name: "Lip Filler", slug: "lip-filler", catIdx: 0, alias: ["Lip Augmentation", "Lip Enhancement"], summary: "Fuller, perfectly shaped lips.", what_it_is: "Targeted dermal filler injections to enhance lip volume, shape, and definition.", how_it_works: "Hyaluronic acid filler is precisely injected into the lip borders and body to create natural-looking fullness.", cost_low: 400, cost_high: 900, recovery: "2-3 days swelling", duration: 20 },
  { name: "Kybella", slug: "kybella", catIdx: 0, alias: ["Double Chin Treatment"], summary: "Dissolve stubborn chin fat without surgery.", what_it_is: "An FDA-approved injectable that destroys fat cells under the chin to improve profile contour.", how_it_works: "Deoxycholic acid injections break down and absorb dietary fat beneath the chin over a series of treatments.", cost_low: 1200, cost_high: 2400, recovery: "3-5 days swelling", duration: 20 },

  // Laser Treatments
  { name: "Laser Hair Removal", slug: "laser-hair-removal", catIdx: 1, alias: ["LHR", "Permanent Hair Reduction"], summary: "Smooth, hair-free skin for good.", what_it_is: "Medical-grade laser treatment that permanently reduces unwanted hair growth on face and body.", how_it_works: "Concentrated light energy targets melanin in hair follicles, destroying the root while leaving surrounding skin unharmed.", cost_low: 150, cost_high: 500, recovery: "None", duration: 30 },
  { name: "Laser Skin Resurfacing", slug: "laser-skin-resurfacing", catIdx: 1, alias: ["Fraxel", "CO2 Laser"], summary: "Dramatically improve skin texture and tone.", what_it_is: "Ablative or non-ablative laser treatment that removes damaged skin layers to reveal smoother, younger-looking skin.", how_it_works: "Laser energy creates controlled micro-injuries in the skin, triggering the body's natural healing response and collagen production.", cost_low: 800, cost_high: 3000, recovery: "5-10 days", duration: 45 },
  { name: "IPL Photofacial", slug: "ipl-photofacial", catIdx: 1, alias: ["Intense Pulsed Light", "BBL"], summary: "Even out skin tone and reduce sun damage.", what_it_is: "Broad-spectrum light therapy that targets pigmentation, redness, and sun damage for a more even complexion.", how_it_works: "Intense pulsed light penetrates the skin to target melanin and hemoglobin, reducing brown spots and visible blood vessels.", cost_low: 300, cost_high: 700, recovery: "1-3 days", duration: 30 },

  // Body Contouring
  { name: "CoolSculpting", slug: "coolsculpting", catIdx: 2, alias: ["Cryolipolysis", "Fat Freezing"], summary: "Freeze away stubborn fat — no surgery needed.", what_it_is: "FDA-cleared cryolipolysis treatment that freezes and eliminates stubborn fat cells in targeted areas.", how_it_works: "Controlled cooling is applied to fat deposits, crystallizing fat cells which are then naturally eliminated by the body over weeks.", cost_low: 750, cost_high: 2000, recovery: "None to 1 day", duration: 60 },
  { name: "Emsculpt NEO", slug: "emsculpt-neo", catIdx: 2, alias: ["Emsculpt", "Muscle Sculpting"], summary: "Build muscle and burn fat simultaneously.", what_it_is: "Combines radiofrequency and HIFEM energy to simultaneously build muscle and reduce fat.", how_it_works: "RF heating raises muscle temperature while HIFEM energy induces 20,000 supramaximal contractions per session.", cost_low: 800, cost_high: 1500, recovery: "None", duration: 30 },

  // Skin Rejuvenation
  { name: "Microneedling", slug: "microneedling", catIdx: 3, alias: ["Collagen Induction Therapy", "SkinPen"], summary: "Stimulate your skin's natural collagen production.", what_it_is: "Minimally invasive treatment using fine needles to create micro-channels in the skin, triggering natural healing.", how_it_works: "A device with tiny needles creates controlled punctures in the skin, stimulating collagen and elastin production for firmer, smoother skin.", cost_low: 250, cost_high: 700, recovery: "2-3 days", duration: 45 },
  { name: "Chemical Peel", slug: "chemical-peel", catIdx: 3, alias: ["Glycolic Peel", "TCA Peel"], summary: "Reveal fresh, radiant skin beneath the surface.", what_it_is: "Professional-strength chemical solutions applied to the skin to exfoliate damaged outer layers.", how_it_works: "Acid solutions dissolve the bonds between dead skin cells, accelerating cell turnover and revealing smoother, brighter skin.", cost_low: 150, cost_high: 500, recovery: "3-7 days", duration: 30 },
  { name: "PRP Facial", slug: "prp-facial", catIdx: 3, alias: ["Vampire Facial", "Platelet-Rich Plasma"], summary: "Harness your body's own healing power for younger skin.", what_it_is: "A treatment combining microneedling with platelet-rich plasma derived from your own blood.", how_it_works: "Your blood is drawn and centrifuged to isolate growth factor-rich platelets, which are then applied to microneedled skin to enhance rejuvenation.", cost_low: 600, cost_high: 1200, recovery: "2-3 days", duration: 60 },

  // Facial Treatments
  { name: "HydraFacial", slug: "hydrafacial", catIdx: 4, alias: ["Hydradermabrasion"], summary: "The ultimate glow-boosting facial.", what_it_is: "A multi-step facial treatment that cleanses, exfoliates, extracts, and hydrates the skin simultaneously.", how_it_works: "Patented Vortex technology deep-cleans pores while infusing skin with nourishing serums containing hyaluronic acid and antioxidants.", cost_low: 150, cost_high: 350, recovery: "None", duration: 30 },
  { name: "Oxygen Facial", slug: "oxygen-facial", catIdx: 4, alias: ["OxyGeneo"], summary: "Infuse your skin with pure oxygen and nutrients.", what_it_is: "A pressurized oxygen delivery system that infuses serums deep into the skin for instant radiance.", how_it_works: "Hyperbaric oxygen pushes customized serum formulas into the epidermis, boosting hydration and cellular metabolism.", cost_low: 120, cost_high: 250, recovery: "None", duration: 45 },

  // Wellness & IV Therapy
  { name: "IV Vitamin Therapy", slug: "iv-vitamin-therapy", catIdx: 5, alias: ["IV Drip", "Myers Cocktail"], summary: "Recharge from the inside out.", what_it_is: "Intravenous delivery of vitamins, minerals, and amino acids for rapid absorption and immediate benefits.", how_it_works: "A customized blend of nutrients is delivered directly into your bloodstream, bypassing the digestive system for 100% absorption.", cost_low: 150, cost_high: 400, recovery: "None", duration: 45 },
  { name: "Hormone Therapy", slug: "hormone-therapy", catIdx: 5, alias: ["Bioidentical Hormones", "HRT"], summary: "Restore hormonal balance for optimal wellness.", what_it_is: "Bioidentical hormone replacement therapy to address age-related hormonal decline.", how_it_works: "Custom-compounded hormones identical to your body's natural hormones are delivered via pellets, creams, or injections.", cost_low: 300, cost_high: 800, recovery: "None", duration: 30 },

  // Hair Restoration
  { name: "PRP Hair Treatment", slug: "prp-hair-treatment", catIdx: 6, alias: ["PRP Hair Restoration"], summary: "Revitalize thinning hair with your body's own growth factors.", what_it_is: "Platelet-rich plasma injections into the scalp to stimulate hair follicle activity and promote new hair growth.", how_it_works: "Concentrated platelets from your blood are injected into areas of thinning hair, releasing growth factors that stimulate dormant follicles.", cost_low: 700, cost_high: 1500, recovery: "None to 1 day", duration: 45 },

  // Skin Tightening
  { name: "Ultherapy", slug: "ultherapy", catIdx: 7, alias: ["Ultrasound Skin Tightening", "HIFU"], summary: "Lift and tighten without surgery.", what_it_is: "FDA-cleared ultrasound treatment that lifts and tightens skin on the face, neck, and décolletage.", how_it_works: "Focused ultrasound energy reaches deep foundational layers of skin, stimulating collagen production for a natural lifting effect.", cost_low: 1500, cost_high: 4500, recovery: "None to mild redness", duration: 60 },
  { name: "Morpheus8", slug: "morpheus8", catIdx: 7, alias: ["RF Microneedling", "Fractional RF"], summary: "Remodel skin from the inside out with radiofrequency.", what_it_is: "A minimally invasive treatment combining microneedling with radiofrequency energy for deep skin remodeling.", how_it_works: "Tiny needles deliver RF energy to the deeper layers of skin, triggering collagen production and fat coagulation for tighter, smoother skin.", cost_low: 800, cost_high: 2000, recovery: "3-5 days", duration: 45 },
];

const providers = [
  // Glow Aesthetics Group (bizIdx: 0) — 3 providers
  { bizIdx: 0, name: "Dr. Sofia Martinez", slug: "dr-sofia-martinez", title: "MD", designation: "Medical Director", bio: "Board-certified dermatologist with over 15 years of experience in cosmetic dermatology. Fellowship-trained at NYU Langone. Known for her natural-looking injectable results.", years_experience: 15, specializations: ["Injectables", "Laser", "Skin Rejuvenation"] },
  { bizIdx: 0, name: "Nurse Jessica Nguyen", slug: "nurse-jessica-nguyen", title: "NP-C", designation: "Lead Injector", bio: "Certified nurse practitioner specializing in facial aesthetics. Trained directly under leading plastic surgeons in Miami. Expert in lip augmentation and facial balancing.", years_experience: 8, specializations: ["Injectables", "Lip Filler"] },
  { bizIdx: 0, name: "Ashley Chen", slug: "ashley-chen", title: "LE", designation: "Senior Aesthetician", bio: "Licensed aesthetician with advanced certifications in medical-grade facials and chemical peels. Passionate about customized skincare protocols.", years_experience: 6, specializations: ["Facial Treatments", "Chemical Peels"] },

  // Radiance MedSpa (bizIdx: 1) — 3 providers
  { bizIdx: 1, name: "Dr. Michael Brooks", slug: "dr-michael-brooks", title: "MD, FACS", designation: "Founder & Medical Director", bio: "Double board-certified plastic surgeon and aesthetic medicine specialist. Published researcher in non-surgical facial rejuvenation. Featured in Vogue and Allure.", years_experience: 20, specializations: ["Injectables", "Body Contouring", "Skin Tightening"] },
  { bizIdx: 1, name: "Dr. Priya Patel", slug: "dr-priya-patel", title: "DO", designation: "Aesthetic Physician", bio: "Osteopathic physician specializing in holistic aesthetic treatments. Combines Eastern and Western approaches to beauty and wellness.", years_experience: 10, specializations: ["Wellness", "Injectables", "Regenerative Medicine"] },
  { bizIdx: 1, name: "Samantha Rivera", slug: "samantha-rivera", title: "PA-C", designation: "Injectable Specialist", bio: "Physician assistant with dedicated training in advanced injectable techniques. Known for her meticulous attention to facial symmetry.", years_experience: 7, specializations: ["Dermal Fillers", "Botox", "Kybella"] },

  // Pacific Skin Institute (bizIdx: 2) — 3 providers
  { bizIdx: 2, name: "Dr. James Wellington", slug: "dr-james-wellington", title: "MD, PhD", designation: "Chief Dermatologist", bio: "Harvard-trained dermatologist with a PhD in cutaneous biology. Pioneer in laser-assisted drug delivery systems. Consults for leading skincare brands.", years_experience: 22, specializations: ["Laser Treatments", "Skin Rejuvenation", "Research"] },
  { bizIdx: 2, name: "Dr. Emily Chen-Nakamura", slug: "dr-emily-chen-nakamura", title: "MD", designation: "Cosmetic Dermatologist", bio: "Board-certified dermatologist with specialized training in ethnic skin treatments. Expert in treating hyperpigmentation and melasma across all skin types.", years_experience: 12, specializations: ["Skin Rejuvenation", "Chemical Peels", "IPL"] },
  { bizIdx: 2, name: "Tiffany Park", slug: "tiffany-park", title: "RN, BSN", designation: "Aesthetic Nurse Specialist", bio: "Registered nurse with advanced certifications in laser safety and operation. Over 3,000 laser hair removal treatments performed.", years_experience: 9, specializations: ["Laser Hair Removal", "IPL", "Skin Tightening"] },

  // Luxe Derma Clinic (bizIdx: 3) — 2 providers
  { bizIdx: 3, name: "Dr. Rachel Kim", slug: "dr-rachel-kim", title: "MD", designation: "Dermatologist & Owner", bio: "Board-certified dermatologist who trained at UT Southwestern. Passionate about making medical-grade skincare accessible and approachable.", years_experience: 11, specializations: ["Microneedling", "PRP", "Injectables"] },
  { bizIdx: 3, name: "Lauren Davis", slug: "lauren-davis", title: "NP", designation: "Aesthetic Nurse Practitioner", bio: "Family nurse practitioner turned aesthetic specialist. Certified in advanced Botox and filler techniques. Loves creating customized treatment plans.", years_experience: 5, specializations: ["Botox", "Dermal Fillers", "HydraFacial"] },

  // Bella Vita Aesthetics (bizIdx: 4) — 2 providers
  { bizIdx: 4, name: "Dr. Antonio Rossi", slug: "dr-antonio-rossi", title: "MD, MBA", designation: "Medical Director", bio: "Italian-trained physician combining European aesthetic philosophy with American medical innovation. Known for his artistic approach to facial harmonization.", years_experience: 18, specializations: ["Injectables", "Ultherapy", "Morpheus8"] },
  { bizIdx: 4, name: "Maria Gonzalez", slug: "maria-gonzalez", title: "NP-C", designation: "Senior Injector", bio: "Certified nurse practitioner with a passion for natural beauty. Trained in advanced injection techniques across Europe and the US.", years_experience: 9, specializations: ["Lip Filler", "Dermal Fillers", "Kybella"] },

  // Pristine Skin Center (bizIdx: 6) — 2 providers
  { bizIdx: 6, name: "Dr. Amanda Foster", slug: "dr-amanda-foster", title: "MD", designation: "Founder", bio: "Northwestern-trained dermatologist and Gold Coast institution. One of Chicago's Top Doctors for 10 consecutive years.", years_experience: 25, specializations: ["Laser Treatments", "Skin Rejuvenation", "Injectables"] },
  { bizIdx: 6, name: "David Okafor", slug: "david-okafor", title: "PA-C", designation: "Physician Assistant", bio: "Physician assistant specializing in body contouring and skin tightening. Emsculpt NEO and CoolSculpting certified trainer.", years_experience: 6, specializations: ["Body Contouring", "CoolSculpting", "Emsculpt"] },

  // Haus of Beauty (bizIdx: 8) — 2 providers
  { bizIdx: 8, name: "Dr. Vanessa Blake", slug: "dr-vanessa-blake", title: "MD", designation: "Medical Director", bio: "Emergency medicine physician turned aesthetic expert. Known for bold, dramatic results that Las Vegas clients love.", years_experience: 13, specializations: ["Injectables", "Body Contouring", "IV Therapy"] },
  { bizIdx: 8, name: "Brittany Thompson", slug: "brittany-thompson", title: "RN", designation: "Lead Aesthetic Nurse", bio: "Registered nurse with a flair for the dramatic. Specializes in lip augmentation and non-surgical rhinoplasty. Instagram-famous for her before-and-after content.", years_experience: 7, specializations: ["Lip Filler", "Non-Surgical Rhinoplasty", "Botox"] },

  // Elite Aesthetic Partners (bizIdx: 10) — 2 providers
  { bizIdx: 10, name: "Dr. William Bradford", slug: "dr-william-bradford", title: "MD, FAAD", designation: "Chief Medical Officer", bio: "Fellowship-trained Mohs surgeon and cosmetic dermatologist. Dual board-certified with over 30 publications in peer-reviewed journals.", years_experience: 19, specializations: ["Laser Treatments", "Skin Cancer", "Injectables"] },
  { bizIdx: 10, name: "Christina Vasquez", slug: "christina-vasquez", title: "NP-C", designation: "Director of Aesthetics", bio: "Nurse practitioner leading a team of injectors across the DFW metroplex. National trainer for a leading neurotoxin brand.", years_experience: 10, specializations: ["Botox", "Dermal Fillers", "Morpheus8"] },

  // Serenity Skin Lab (bizIdx: 9) — 1 provider
  { bizIdx: 9, name: "Dr. Hannah Moore", slug: "dr-hannah-moore", title: "DO", designation: "Owner & Practitioner", bio: "Osteopathic physician with a holistic approach to aesthetics. Combines medical treatments with nutrition counseling for whole-body beauty.", years_experience: 8, specializations: ["Wellness", "IV Therapy", "Microneedling"] },

  // Coastal Glow MedSpa (bizIdx: 11) — 1 provider
  { bizIdx: 11, name: "Dr. Sarah Liang", slug: "dr-sarah-liang", title: "MD", designation: "Dermatologist", bio: "UCSD-trained dermatologist specializing in sun damage repair and anti-aging for active, outdoor lifestyles.", years_experience: 14, specializations: ["Laser Treatments", "IPL", "Chemical Peels"] },
];

const concerns = [
  { name: "Acne Scars", slug: "acne-scars", description: "Post-acne scarring including ice pick, boxcar, and rolling scars.", overview: "Acne scars are permanent textural changes caused by inflammatory acne. Modern treatments can significantly improve their appearance.", serviceIdxs: [9, 10, 11, 5, 18] },
  { name: "Fine Lines & Wrinkles", slug: "fine-lines-wrinkles", description: "Age-related facial lines including crow's feet, forehead lines, and marionette lines.", overview: "Fine lines and wrinkles develop as collagen production slows with age. Multiple treatment options exist from injectables to energy-based devices.", serviceIdxs: [0, 1, 9, 17, 18] },
  { name: "Sun Damage", slug: "sun-damage", description: "Hyperpigmentation, age spots, and uneven skin tone from UV exposure.", overview: "Years of sun exposure cause dark spots, uneven pigmentation, and premature aging. Professional treatments can reverse visible damage.", serviceIdxs: [6, 5, 10, 12] },
  { name: "Double Chin", slug: "double-chin", description: "Submental fullness — excess fat beneath the chin area.", overview: "A double chin can be caused by weight, genetics, or aging. Non-surgical options now exist to permanently eliminate submental fat.", serviceIdxs: [3, 7] },
  { name: "Volume Loss", slug: "volume-loss", description: "Age-related loss of facial fat causing hollow cheeks and sunken eyes.", overview: "As we age, we lose facial fat, bone density, and collagen, leading to a hollow, aged appearance. Dermal fillers can restore youthful contours.", serviceIdxs: [1, 11, 17] },
  { name: "Unwanted Hair", slug: "unwanted-hair", description: "Excess or unwanted body and facial hair.", overview: "Unwanted hair growth can be caused by genetics, hormones, or medical conditions. Laser technology offers a permanent reduction solution.", serviceIdxs: [4] },
  { name: "Sagging Skin", slug: "sagging-skin", description: "Skin laxity on face, neck, and body due to aging or weight loss.", overview: "Loss of collagen and elastin causes skin to sag over time. Energy-based treatments can stimulate tightening without surgery.", serviceIdxs: [17, 18, 8] },
  { name: "Dull Skin", slug: "dull-skin", description: "Lackluster, tired-looking skin that lacks radiance.", overview: "Environmental stress, dehydration, and slow cell turnover contribute to dull skin. Professional treatments restore a healthy glow.", serviceIdxs: [12, 13, 10, 14] },
  { name: "Hair Thinning", slug: "hair-thinning", description: "Gradual hair loss and thinning affecting scalp coverage.", overview: "Hair thinning affects both men and women. PRP and other regenerative treatments can stimulate new growth and strengthen existing hair.", serviceIdxs: [16] },
  { name: "Stubborn Fat", slug: "stubborn-fat", description: "Diet and exercise-resistant fat deposits on the body.", overview: "Stubborn fat pockets resist lifestyle changes. Non-surgical body contouring can permanently eliminate fat cells in targeted areas.", serviceIdxs: [7, 8, 3] },
];

const reviewTemplates = [
  { rating: 5, body: "Absolutely incredible experience! The staff was so professional and the results exceeded my expectations. I'll definitely be coming back.", reviewer: "Sarah M." },
  { rating: 5, body: "Best medspa I've ever been to. The doctor really took time to understand what I wanted and the results look so natural.", reviewer: "Jennifer L." },
  { rating: 4, body: "Great results and very clean facility. The only reason for 4 stars is the wait time was a bit long, but the treatment itself was worth it.", reviewer: "Amanda K." },
  { rating: 5, body: "I was nervous about my first time getting injectables but the nurse made me feel completely at ease. Love my results!", reviewer: "Michelle T." },
  { rating: 4, body: "Professional staff and beautiful office. Pricing is on the higher end but you get what you pay for. Very happy with my treatment.", reviewer: "Rachel S." },
  { rating: 5, body: "I've been coming here for two years and every visit is consistent. The team really knows what they're doing.", reviewer: "Lisa P." },
  { rating: 3, body: "Decent experience overall. The treatment was effective but I felt a bit rushed. Would appreciate more personalized attention.", reviewer: "Karen B." },
  { rating: 5, body: "The best Botox I've ever had! No frozen look at all — just smooth, natural skin. My coworkers think I just look well-rested.", reviewer: "Emily W." },
  { rating: 4, body: "Love the HydraFacial here! My skin glows for weeks after each session. The aesthetician is very knowledgeable about products too.", reviewer: "Stephanie R." },
  { rating: 5, body: "Had CoolSculpting on my love handles and I can already see a difference after just one session. The staff walked me through everything.", reviewer: "David H." },
  { rating: 5, body: "Dr. took the time to explain every option and never pressured me into anything. Finally found a provider I trust completely.", reviewer: "Nicole F." },
  { rating: 4, body: "Really pleased with my laser treatment results. Slight redness lasted a couple days but my skin looks amazing now. Worth it!", reviewer: "Catherine D." },
  { rating: 5, body: "Five stars isn't enough! The entire experience from booking to aftercare was seamless. My lip filler looks perfect and natural.", reviewer: "Brittany J." },
  { rating: 3, body: "Good clinic but parking is a nightmare. The actual treatment was fine and staff were friendly enough.", reviewer: "Mark T." },
  { rating: 5, body: "I drove two hours to come here because of the amazing reviews and it was totally worth the trip. Exceptional care.", reviewer: "Lauren G." },
  { rating: 4, body: "Clean, modern facility with a nice relaxing atmosphere. The chemical peel gave me great results. Will book again.", reviewer: "Olivia N." },
  { rating: 5, body: "Transformed my skin! After years of dealing with sun damage, the IPL treatments here have made such a huge difference.", reviewer: "Patricia M." },
  { rating: 5, body: "The IV therapy was exactly what I needed after a stressful month. Felt rejuvenated immediately. The nurse was so gentle.", reviewer: "Jessica A." },
  { rating: 4, body: "Very impressed with the consultation process. They didn't try to upsell me on treatments I didn't need. Honest and professional.", reviewer: "Rebecca C." },
  { rating: 5, body: "My Morpheus8 results are stunning. Yes, there was some downtime but the improvement in my skin texture is dramatic.", reviewer: "Angela V." },
];

// ─── Seed Function ────────────────────────────────────────────────────────────

async function seedData() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    console.log("🌱 Starting data seed...\n");

    // ── 1. Insert Businesses ──────────────────────────────────────────────
    console.log("⏳ Inserting businesses...");
    const businessIds: string[] = [];
    for (const biz of businesses) {
      const result = await client.query(
        `INSERT INTO businesses (name, slug, website_url, phone, email, city, state, tier, verified, verified_at, about, meta_title, meta_description, data_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'manual')
         RETURNING id`,
        [
          biz.name, biz.slug, biz.website_url, biz.phone, biz.email,
          biz.city, biz.state, biz.tier,
          biz.verified, biz.verified ? new Date() : null,
          biz.about,
          `${biz.name} | Premium MedSpa in ${biz.city}, ${biz.state}`,
          `${biz.about?.substring(0, 155)}...`,
        ]
      );
      businessIds.push(result.rows[0].id);
    }
    console.log(`✓ ${businessIds.length} businesses inserted`);

    // ── 2. Insert Clinics ─────────────────────────────────────────────────
    console.log("⏳ Inserting clinics...");
    const clinicIds: string[] = [];
    const clinicBizMap: number[] = []; // track which business index each clinic belongs to
    const defaultHours = JSON.stringify({
      MONDAY: { open: "09:00", close: "18:00", is_open: true },
      TUESDAY: { open: "09:00", close: "18:00", is_open: true },
      WEDNESDAY: { open: "09:00", close: "18:00", is_open: true },
      THURSDAY: { open: "09:00", close: "19:00", is_open: true },
      FRIDAY: { open: "09:00", close: "17:00", is_open: true },
      SATURDAY: { open: "10:00", close: "15:00", is_open: true },
      SUNDAY: { open: "00:00", close: "00:00", is_open: false },
    });

    for (const clinic of clinics) {
      const bizId = businessIds[clinic.bizIdx];
      const result = await client.query(
        `INSERT INTO clinics (business_id, name, slug, address, city, state, zip, country, lat, lng, phone, tier, verified, featured, about, hours, meta_title, meta_description, data_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'US', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'manual')
         RETURNING id`,
        [
          bizId, clinic.name, clinic.slug, clinic.address,
          clinic.city, clinic.state, clinic.zip,
          clinic.lat, clinic.lng, clinic.phone,
          clinic.tier, clinic.verified, clinic.featured,
          clinic.about, defaultHours,
          `${clinic.name} | Aesthetic Treatments in ${clinic.city}, ${clinic.state}`,
          `Visit ${clinic.name} in ${clinic.city}, ${clinic.state}. ${clinic.about?.substring(0, 120)}...`,
        ]
      );
      clinicIds.push(result.rows[0].id);
      clinicBizMap.push(clinic.bizIdx);
    }
    console.log(`✓ ${clinicIds.length} clinics inserted`);

    // ── 3. Insert Categories ──────────────────────────────────────────────
    console.log("⏳ Inserting categories...");
    const categoryIds: string[] = [];
    for (const cat of categories) {
      const result = await client.query(
        `INSERT INTO categories (name, slug, description, display_order, data_source)
         VALUES ($1, $2, $3, $4, 'manual')
         RETURNING id`,
        [cat.name, cat.slug, cat.description, cat.display_order]
      );
      categoryIds.push(result.rows[0].id);
    }
    console.log(`✓ ${categoryIds.length} categories inserted`);

    // ── 4. Insert Services ────────────────────────────────────────────────
    console.log("⏳ Inserting services...");
    const serviceIds: string[] = [];
    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      const result = await client.query(
        `INSERT INTO services (name, slug, alias, summary, what_it_is, how_it_works, cost_range_low, cost_range_high, recovery_time, duration_minutes, is_active, is_published, display_order, data_source,
          meta_title, meta_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, TRUE, $11, 'manual', $12, $13)
         RETURNING id`,
        [
          svc.name, svc.slug, svc.alias || [],
          svc.summary, svc.what_it_is, svc.how_it_works,
          svc.cost_low, svc.cost_high,
          svc.recovery, svc.duration,
          i,
          `${svc.name} Treatment | MedSpa Maps`,
          `Learn about ${svc.name}: ${svc.summary} Find clinics near you offering ${svc.name.toLowerCase()}.`,
        ]
      );
      serviceIds.push(result.rows[0].id);
    }
    console.log(`✓ ${serviceIds.length} services inserted`);

    // ── 5. Insert Service ↔ Category junctions ────────────────────────────
    console.log("⏳ Linking services to categories...");
    let scCount = 0;
    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      await client.query(
        `INSERT INTO service_categories (service_id, category_id, is_primary) VALUES ($1, $2, TRUE)`,
        [serviceIds[i], categoryIds[svc.catIdx]]
      );
      scCount++;
    }
    console.log(`✓ ${scCount} service_categories linked`);

    // ── 6. Insert Providers ───────────────────────────────────────────────
    console.log("⏳ Inserting providers...");
    const providerIds: string[] = [];
    const providerBizMap: number[] = [];
    for (const prov of providers) {
      const bizId = businessIds[prov.bizIdx];
      const result = await client.query(
        `INSERT INTO providers (business_id, name, slug, title, designation, bio, years_experience, specializations, is_active, data_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'manual')
         RETURNING id`,
        [
          bizId, prov.name, prov.slug, prov.title, prov.designation,
          prov.bio, prov.years_experience, prov.specializations,
        ]
      );
      providerIds.push(result.rows[0].id);
      providerBizMap.push(prov.bizIdx);
    }
    console.log(`✓ ${providerIds.length} providers inserted`);

    // ── 7. Link Providers to Clinics ──────────────────────────────────────
    console.log("⏳ Linking providers to clinics...");
    let cpCount = 0;
    for (let pIdx = 0; pIdx < providers.length; pIdx++) {
      const provBizIdx = providerBizMap[pIdx];
      // Find all clinics belonging to this provider's business
      for (let cIdx = 0; cIdx < clinics.length; cIdx++) {
        if (clinicBizMap[cIdx] === provBizIdx) {
          await client.query(
            `INSERT INTO clinic_providers (clinic_id, provider_id, is_primary, is_active)
             VALUES ($1, $2, $3, TRUE)`,
            [clinicIds[cIdx], providerIds[pIdx], cpCount === 0] // first assignment is primary
          );
          cpCount++;
        }
      }
    }
    console.log(`✓ ${cpCount} clinic_providers linked`);

    // ── 8. Link Services to Clinics ───────────────────────────────────────
    console.log("⏳ Linking services to clinics...");
    let csCount = 0;
    for (let cIdx = 0; cIdx < clinics.length; cIdx++) {
      // Each clinic gets a random subset of services (at least 6, up to 14)
      const numServices = 6 + Math.floor(Math.random() * 9);
      const shuffled = [...serviceIds].sort(() => Math.random() - 0.5);
      const clinicServiceSubset = shuffled.slice(0, numServices);

      for (let sIdx = 0; sIdx < clinicServiceSubset.length; sIdx++) {
        const svcId = clinicServiceSubset[sIdx];
        const origIdx = serviceIds.indexOf(svcId);
        const svc = services[origIdx];
        const priceMod = 0.8 + Math.random() * 0.4; // ±20% variation
        await client.query(
          `INSERT INTO clinic_services (clinic_id, service_id, price_from, price_to, featured_service, is_active, display_order, data_source)
           VALUES ($1, $2, $3, $4, $5, TRUE, $6, 'manual')`,
          [
            clinicIds[cIdx],
            svcId,
            Math.round(svc.cost_low * priceMod),
            Math.round(svc.cost_high * priceMod),
            sIdx < 3, // first 3 services are featured
            sIdx,
          ]
        );
        csCount++;
      }
    }
    console.log(`✓ ${csCount} clinic_services linked`);

    // ── 9. Insert Reviews ─────────────────────────────────────────────────
    console.log("⏳ Inserting reviews...");
    let reviewCount = 0;
    for (let cIdx = 0; cIdx < clinicIds.length; cIdx++) {
      // Each clinic gets 2-5 reviews
      const numReviews = 2 + Math.floor(Math.random() * 4);
      for (let r = 0; r < numReviews; r++) {
        const tmpl = reviewTemplates[(cIdx * 3 + r) % reviewTemplates.length];
        const sources = ["google", "yelp", "internal"] as const;
        const source = sources[r % 3];
        await client.query(
          `INSERT INTO reviews (clinic_id, rating, body, reviewer_name, source, is_approved, data_source)
           VALUES ($1, $2, $3, $4, $5, TRUE, 'manual')`,
          [clinicIds[cIdx], tmpl.rating, tmpl.body, tmpl.reviewer, source]
        );
        reviewCount++;
      }
    }
    console.log(`✓ ${reviewCount} reviews inserted`);

    // ── 10. Insert Concerns ───────────────────────────────────────────────
    console.log("⏳ Inserting concerns...");
    const concernIds: string[] = [];
    for (const concern of concerns) {
      const result = await client.query(
        `INSERT INTO concerns (name, slug, description, overview, is_active, is_published, meta_title, meta_description)
         VALUES ($1, $2, $3, $4, TRUE, TRUE, $5, $6)
         RETURNING id`,
        [
          concern.name, concern.slug, concern.description, concern.overview,
          `${concern.name} Treatments | MedSpa Maps`,
          `Discover the best treatments for ${concern.name.toLowerCase()}. ${concern.description}`,
        ]
      );
      concernIds.push(result.rows[0].id);
    }
    console.log(`✓ ${concernIds.length} concerns inserted`);

    // ── 11. Link Concerns to Services ─────────────────────────────────────
    console.log("⏳ Linking concerns to services...");
    let csvcCount = 0;
    for (let i = 0; i < concerns.length; i++) {
      for (let j = 0; j < concerns[i].serviceIdxs.length; j++) {
        const svcIdx = concerns[i].serviceIdxs[j];
        if (svcIdx < serviceIds.length) {
          await client.query(
            `INSERT INTO concern_services (concern_id, service_id, display_order)
             VALUES ($1, $2, $3)`,
            [concernIds[i], serviceIds[svcIdx], j]
          );
          csvcCount++;
        }
      }
    }
    console.log(`✓ ${csvcCount} concern_services linked`);

    // ── 12. Insert Sample Images ──────────────────────────────────────────
    console.log("⏳ Inserting sample images...");
    let imgCount = 0;
    // Clinic cover images (using placeholder URLs)
    for (let cIdx = 0; cIdx < clinicIds.length; cIdx++) {
      await client.query(
        `INSERT INTO images (entity_type, entity_id, source_url, role, sort_order, alt_text, scrape_status, data_source)
         VALUES ('clinic', $1, $2, 'cover', 0, $3, 'ok', 'manual')`,
        [
          clinicIds[cIdx],
          `https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&q=80&idx=${cIdx}`,
          `${clinics[cIdx].name} clinic exterior`,
        ]
      );
      imgCount++;
    }
    // Provider avatars
    for (let pIdx = 0; pIdx < providerIds.length; pIdx++) {
      await client.query(
        `INSERT INTO images (entity_type, entity_id, source_url, role, sort_order, alt_text, scrape_status, data_source)
         VALUES ('provider', $1, $2, 'avatar', 0, $3, 'ok', 'manual')`,
        [
          providerIds[pIdx],
          `https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80&idx=${pIdx}`,
          `${providers[pIdx].name} headshot`,
        ]
      );
      imgCount++;
    }
    console.log(`✓ ${imgCount} images inserted`);

    // ── 13. Insert Sample Listing Claims ──────────────────────────────────
    console.log("⏳ Inserting sample listing claims...");
    // Claims for unclaimed businesses (free tier, not verified)
    const unclaimedBizIdxs = [5, 7, 9]; // Revive, Zenith, Serenity
    const claimData = [
      { name: "Robert Chen", email: "robert@revivewellness.com", phone: "(404) 555-9999", status: "pending" },
      { name: "Lisa Zhang", email: "lisa@zenithmedspa.com", phone: "(415) 555-8888", status: "verified" },
      { name: "Hannah Moore", email: "hannah@serenityskinlab.com", phone: "(615) 555-7777", status: "approved" },
    ];
    for (let i = 0; i < unclaimedBizIdxs.length; i++) {
      const cd = claimData[i];
      await client.query(
        `INSERT INTO listing_claims (business_id, contact_name, contact_email, contact_phone, status, source_page)
         VALUES ($1, $2, $3, $4, $5, '/claim')`,
        [businessIds[unclaimedBizIdxs[i]], cd.name, cd.email, cd.phone, cd.status]
      );
    }
    console.log(`✓ ${claimData.length} listing claims inserted`);

    // ── 14. Create Materialized View ──────────────────────────────────────
    console.log("⏳ Creating materialized view...");
    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS clinic_search_view AS
      SELECT
        c.id                                  AS clinic_id,
        c.name                                AS clinic_name,
        c.slug                                AS clinic_slug,
        c.city,
        c.state,
        c.address,
        c.phone,
        c.lat,
        c.lng,
        c.avg_rating,
        c.review_count,
        c.featured,
        c.tier,
        c.verified,
        c.hours,
        b.id                                  AS business_id,
        b.name                                AS business_name,
        b.logo_url,
        ARRAY_AGG(DISTINCT s.slug)            AS service_slugs,
        ARRAY_AGG(DISTINCT s.name)            AS service_names,
        ARRAY_AGG(DISTINCT cat.slug)          AS category_slugs,
        (SELECT source_url FROM images
         WHERE entity_type = 'clinic' AND entity_id = c.id
         AND role = 'cover' AND scrape_status = 'ok'
         ORDER BY sort_order LIMIT 1)         AS cover_image_url
      FROM clinics c
      JOIN businesses b         ON b.id = c.business_id
      JOIN clinic_services cs   ON cs.clinic_id = c.id AND cs.is_active = TRUE
      JOIN services s           ON s.id = cs.service_id AND s.is_active = TRUE
      JOIN service_categories sc ON sc.service_id = s.id
      JOIN categories cat       ON cat.id = sc.category_id
      WHERE c.is_active = TRUE
        AND b.is_active = TRUE
      GROUP BY c.id, b.id
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_search_view_id ON clinic_search_view (clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_clinic_search_city ON clinic_search_view (lower(city), lower(state))`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_clinic_search_services ON clinic_search_view USING gin (service_slugs)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_clinic_search_featured ON clinic_search_view (featured, avg_rating DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_clinic_search_tier ON clinic_search_view (tier)`);
    console.log("✓ Materialized view created");

    await client.query("COMMIT");
    console.log("\n✅ Seed complete! Database populated with dummy data.");
    console.log(`
📊 Summary:
   • ${businessIds.length} businesses
   • ${clinicIds.length} clinics
   • ${providerIds.length} providers
   • ${categoryIds.length} categories
   • ${serviceIds.length} services
   • ${csCount} clinic↔service links
   • ${cpCount} clinic↔provider links
   • ${reviewCount} reviews
   • ${concernIds.length} concerns
   • ${csvcCount} concern↔service links
   • ${imgCount} images
   • ${claimData.length} listing claims
`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedData();
