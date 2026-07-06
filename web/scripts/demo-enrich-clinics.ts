/**
 * demo-enrich-clinics.ts — run with: bun scripts/demo-enrich-clinics.ts
 *
 * One-shot, IDEMPOTENT enrichment of the 15 seeded clinics for the demo.
 *
 * For each clinic it:
 *   1. UPDATEs all core fields with cleaned/verified/filled data (address, city,
 *      state, zip, phone, email, booking_url, tagline, about, founded_year,
 *      hours, socials, google_maps_url, stat_*, verified/featured).
 *   2. Fixes coordinates: geocodes the corrected address (Nominatim, free) and
 *      falls back to a hardcoded approximate coordinate if geocoding is
 *      unavailable — so the map is never wrong (fixes the Long Beach→Utah bug).
 *   3. Regenerates a believable set of reviews (deletes prior rows for the
 *      clinic first, so re-running is safe). The refresh_clinic_rating() trigger
 *      then recomputes avg_rating/review_count from those rows.
 *   4. Nulls ext_rating/ext_review_count so the trigger-driven avg_rating /
 *      review_count are the single source of truth everywhere in the UI.
 *
 * Data was verified against each clinic's live website + Google listing; gaps
 * the sources didn't expose are filled with plausible values (this is demo
 * data, not a system of record).
 */

import pool from "../src/lib/db";
import { geocodeAddress } from "../src/lib/geocoder";

type Hours = Record<
  string,
  { open: string | null; close: string | null; is_open: boolean }
>;

interface ClinicSeed {
  id: string;
  name?: string; // display-name override (slug is never changed)
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  booking_url: string;
  founded_year: number;
  tagline: string;
  about: string;
  hours: Hours;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  yelp_url: string | null;
  google_maps_url: string | null;
  // hero stats
  stat_experts: string;
  stat_treatments: string;
  stat_patients: string;
  stat_cities: string | null;
  featured: boolean;
  reviewsTarget: number;
  // fallback coords used only if live geocoding fails
  fallbackLat: number;
  fallbackLng: number;
}

const H = (
  weekday: [string, string] | null,
  sat: [string, string] | null,
  sun: [string, string] | null
): Hours => {
  const mk = (v: [string, string] | null) =>
    v ? { open: v[0], close: v[1], is_open: true } : { open: null, close: null, is_open: false };
  return {
    MONDAY: mk(weekday),
    TUESDAY: mk(weekday),
    WEDNESDAY: mk(weekday),
    THURSDAY: mk(weekday),
    FRIDAY: mk(weekday),
    SATURDAY: mk(sat),
    SUNDAY: mk(sun),
  };
};

const CLINICS: ClinicSeed[] = [
  {
    id: "1e0477ea-1a01-4eff-ae85-a5eff0529c7f",
    street: "9279 Old Keene Mill Road",
    city: "Burke",
    state: "VA",
    zip: "22015",
    phone: "888-322-2477",
    email: "therese@aesthetic-artistry.com",
    booking_url:
      "https://squareup.com/appointments/book/o2tkya70prbg23/LWWM939ZAH43C/services",
    founded_year: 2018,
    tagline: "Natural-looking results from a master injector in Burke, VA.",
    about:
      "Aesthetic Artistry is a woman-owned medical spa in Burke, Virginia led by master injector Therese Persson, RN. The practice specializes in neurotoxins, soft dermal fillers, PRX, chemical peels, and microneedling, with personalized treatment plans built around each client's long-term goals.",
    hours: H(["10:00", "18:00"], null, null),
    instagram_url: "https://www.instagram.com/injector_therese/",
    facebook_url: "https://www.facebook.com/AestheticArtistryNoVa",
    tiktok_url: null,
    youtube_url: null,
    linkedin_url: null,
    yelp_url: "https://www.yelp.com/biz/aesthetic-artistry-burke",
    google_maps_url: "https://goo.gl/maps/DgVD8bTY5qvsnusb9",
    stat_experts: "6",
    stat_treatments: "14+",
    stat_patients: "4k+",
    stat_cities: null,
    featured: false,
    reviewsTarget: 16,
    fallbackLat: 38.772916,
    fallbackLng: -77.263704,
  },
  {
    id: "925a650b-7f87-47ea-8b48-4669133cfb6f",
    name: "Aesthetic Medical Lounge",
    street: "917 W Beech St",
    city: "Long Beach",
    state: "NY",
    zip: "11561",
    phone: "516-522-9361",
    email: "aestheticmedicallounge@gmail.com",
    booking_url: "https://aestheticmedicallounge.com/schedule-an-appointment/",
    founded_year: 2019,
    tagline: "Radiance fit for a queen, confidence built for a king.",
    about:
      "Aesthetic Medical Lounge blends science, artistry, and holistic medicine, offering RF microneedling, dermal fillers, and body contouring alongside acupuncture and wellness therapies. Founded by medical aesthetician Denise King, it pairs advanced aesthetics with personalized, whole-body care in Long Beach, NY.",
    hours: H(["09:00", "17:00"], ["09:00", "15:00"], null),
    instagram_url: "https://www.instagram.com/aestheticmedicallounge/",
    facebook_url: "https://www.facebook.com/aestheticmedicallounge/",
    tiktok_url: "https://www.tiktok.com/@aestheticmedicallounge",
    youtube_url: null,
    linkedin_url: null,
    yelp_url: "https://www.yelp.com/biz/aesthetic-medical-lounge-island-park",
    google_maps_url: "https://maps.app.goo.gl/3usBwjyNzY2S5FqS7",
    stat_experts: "8",
    stat_treatments: "40+",
    stat_patients: "6k+",
    stat_cities: "2",
    featured: true,
    reviewsTarget: 21,
    fallbackLat: 40.58853,
    fallbackLng: -73.669,
  },
  {
    id: "5515629c-ef5d-4545-87bf-06b3528d88da",
    street: "491 North Main St",
    city: "Kalispell",
    state: "MT",
    zip: "59901",
    phone: "406-257-8095",
    email: "info@406aesthetica.com",
    booking_url: "https://www.406aesthetica.com/",
    founded_year: 2012,
    tagline: "Montana's trusted med spa for graceful aging and natural beauty.",
    about:
      "Aesthetica Medical Spa is a state-recognized med spa in Kalispell, Montana offering customized treatments like Botox, fillers, facials, and medical-grade skincare. Founded by nurse practitioner Rachael Alsbury, it focuses on graceful aging and enhancing natural beauty, and was named one of Allergan's Top 10 Med Spas in Montana.",
    hours: H(["10:00", "17:00"], null, null),
    instagram_url: "https://www.instagram.com/aesthetica_medical_spa",
    facebook_url: "https://www.facebook.com/406Aesthetica/",
    tiktok_url: null,
    youtube_url: null,
    linkedin_url: null,
    yelp_url: "https://www.yelp.com/biz/aesthetica-medical-spa-kalispell",
    google_maps_url: "https://maps.app.goo.gl/sJec9i3oAT24yDXc9",
    stat_experts: "10",
    stat_treatments: "30+",
    stat_patients: "8k+",
    stat_cities: null,
    featured: false,
    reviewsTarget: 14,
    fallbackLat: 48.2004,
    fallbackLng: -114.312,
  },
  {
    id: "ac5b505f-41cf-4d99-9aad-9c804522f31c",
    street: "5496 S 900 East",
    city: "Murray",
    state: "UT",
    zip: "84117",
    phone: "801-675-8954",
    email: "info@beautylablaser.com",
    booking_url:
      "https://app.decodahealth.com/bll/self-schedule?serviceId=itm_9be21520a2f92197",
    founded_year: 2017,
    tagline: "Led by expertise. Focused on you.",
    about:
      "Beauty Lab + Laser is a Utah medical aesthetics practice with locations in Murray and Riverton, offering laser skin therapies, injectables, biostimulators, facials, and wellness treatments focused on natural-looking results. Founded by Heather Gay and Andrea Robinson.",
    hours: H(["09:00", "20:00"], ["09:00", "17:00"], ["09:00", "14:00"]),
    instagram_url: "https://www.instagram.com/beauty.lab.laser/",
    facebook_url: "https://www.facebook.com/BeautyLabLaser/",
    tiktok_url: "https://www.tiktok.com/@beauty.lab.laser",
    youtube_url: null,
    linkedin_url: "https://www.linkedin.com/company/beauty-lab-laser",
    yelp_url: "https://www.yelp.com/biz/beauty-lab-laser-murray-2",
    google_maps_url: null,
    stat_experts: "18",
    stat_treatments: "200+",
    stat_patients: "20k+",
    stat_cities: "2",
    featured: true,
    reviewsTarget: 24,
    fallbackLat: 40.66684,
    fallbackLng: -111.87123,
  },
  {
    id: "e9fb2610-9a1c-4698-9bb5-e15656ec9d1d",
    street: "204 N 4th St",
    city: "Coeur d'Alene",
    state: "ID",
    zip: "83814",
    phone: "208-889-9881",
    email: "hello.friend@beautyatthelake.com",
    booking_url: "https://booking.mangomint.com/483520",
    founded_year: 2019,
    tagline:
      "Medical aesthetics in downtown Coeur d'Alene focused on natural results and genuine care.",
    about:
      "Beauty at the Lake is a women-owned medical spa in downtown Coeur d'Alene, Idaho, offering injectables, facials, laser treatments, body sculpting, medical weight loss, and massage. Co-founded in 2019, it pairs advanced aesthetics with personalized, results-driven care.",
    hours: H(["10:00", "18:00"], ["09:00", "16:00"], null),
    instagram_url: "https://www.instagram.com/beautyatthelake/",
    facebook_url: "https://www.facebook.com/BeautyattheLake/",
    tiktok_url: "https://www.tiktok.com/@beautyatthelake",
    youtube_url: "https://www.youtube.com/channel/UCiskPV1vLXWal6NIeOig7wQ",
    linkedin_url: null,
    yelp_url: "https://www.yelp.com/biz/beauty-at-the-lake-dalene",
    google_maps_url: "https://maps.app.goo.gl/b9ddXzh7xmfBwXQz9",
    stat_experts: "9",
    stat_treatments: "60+",
    stat_patients: "7k+",
    stat_cities: null,
    featured: true,
    reviewsTarget: 19,
    fallbackLat: 47.679,
    fallbackLng: -116.781,
  },
  {
    id: "034caec0-86d2-404e-bc8f-f89aa86191a1",
    name: "Cherry Medical Aesthetics",
    street: "2200 W 29th Ave Suite 102",
    city: "Denver",
    state: "CO",
    zip: "80211",
    phone: "720-479-8793",
    email: "reception@cherrymedispa.com",
    booking_url:
      "https://www.bizzflo.com/Health-Wellness/Cherry-Medical-Aesthetics/services",
    founded_year: 2016,
    tagline: "Look and feel your best in Denver's LoHi.",
    about:
      "Cherry Medical Aesthetics is a Denver med spa in the LoHi neighborhood offering injectables, laser treatments, microneedling with PRP, chemical peels, HydraFacial, and body contouring. Co-owners Cheryl and Stacy pair medical expertise with a personalized, three-dimensional approach to skincare.",
    hours: H(["10:00", "18:00"], ["09:00", "16:00"], null),
    instagram_url: "https://www.instagram.com/cherrymedicalaesthetics/",
    facebook_url: "https://www.facebook.com/cherrymedicalaesthetics",
    tiktok_url: "https://www.tiktok.com/@cherrymedicalaesthetics",
    youtube_url: null,
    linkedin_url: null,
    yelp_url: "https://www.yelp.com/biz/cherry-medical-aesthetics-denver",
    google_maps_url: "https://maps.app.goo.gl/N3ZeMehXRGRHBKgU6",
    stat_experts: "7",
    stat_treatments: "28+",
    stat_patients: "9k+",
    stat_cities: null,
    featured: false,
    reviewsTarget: 17,
    fallbackLat: 39.76073,
    fallbackLng: -105.0106,
  },
  {
    id: "f21a5fab-8e7b-4ec9-b230-b7abf43b5ee6",
    street: "282 West Main Street",
    city: "Denville",
    state: "NJ",
    zip: "07834",
    phone: "973-957-7171",
    email: "info@exhibitmedicalaesthetics.com",
    booking_url:
      "https://exhibitmedicalaesthetics.myaestheticrecord.com/online-booking",
    founded_year: 2020,
    tagline: "Redefining the med spa experience with whole-face care in Denville, NJ.",
    about:
      "Exhibit Medical Aesthetics is a state-of-the-art medical spa in Denville, NJ, founded by nurse practitioner Nicole Bauer and physician assistant Melissa LaMarca. The team offers Botox, dermal fillers, facials, microneedling, and skincare, with an emphasis on patient safety and whole-face care.",
    hours: H(["09:00", "19:00"], ["09:00", "15:00"], null),
    instagram_url: "https://www.instagram.com/exhibitmedicalaesthetics/",
    facebook_url:
      "https://www.facebook.com/p/Exhibit-Medical-Aesthetics-Skin-Care-100093674412456/",
    tiktok_url: null,
    youtube_url: null,
    linkedin_url: null,
    yelp_url:
      "https://www.yelp.com/biz/exhibit-medical-aesthetics-and-skin-care-denville",
    google_maps_url: null,
    stat_experts: "6",
    stat_treatments: "40+",
    stat_patients: "5k+",
    stat_cities: null,
    featured: false,
    reviewsTarget: 15,
    fallbackLat: 40.8895,
    fallbackLng: -74.4835,
  },
  {
    id: "600f4615-1755-49cf-a778-f1ceded9cdd5",
    street: "352 Denver St Suite 250",
    city: "Salt Lake City",
    state: "UT",
    zip: "84111",
    phone: "385-666-8656",
    email: "info@foreverbeautyspa.com",
    booking_url: "https://foreverbeautyspa.com/#book-now",
    founded_year: 2019,
    tagline:
      "Look as confident and radiant on the outside as you feel on the inside.",
    about:
      "Forever Beauty Med Spa is a medical spa in Salt Lake City offering injectables, facials, laser treatments, and micropigmentation. Every treatment plan is personalized because no two clients are the same.",
    hours: H(["10:00", "19:00"], ["10:00", "19:00"], null),
    instagram_url: "https://www.instagram.com/foreverbeautyus/",
    facebook_url: "https://www.facebook.com/foreverbeautybyemilia/",
    tiktok_url: "https://www.tiktok.com/@foreverbeautyspa.com",
    youtube_url: "https://www.youtube.com/@foreverbeautyutah",
    linkedin_url: null,
    yelp_url: "https://www.yelp.com/biz/forever-beauty-us-salt-lake-city",
    google_maps_url: null,
    stat_experts: "5",
    stat_treatments: "30+",
    stat_patients: "4k+",
    stat_cities: null,
    featured: false,
    reviewsTarget: 13,
    fallbackLat: 40.76,
    fallbackLng: -111.889,
  },
  {
    id: "e1e76e86-d72a-4f05-9682-67f132f48cc7",
    street: "25 Walnut St Suite 101",
    city: "Wellesley",
    state: "MA",
    zip: "02481",
    phone: "781-524-3223",
    email: "info@gfacemd.com",
    booking_url: "https://gfacemd.myaestheticrecord.com/online-booking",
    founded_year: 2018,
    tagline:
      "Harvard-trained medical aesthetics, blending ultrasound-guided injectables with skin-health expertise.",
    about:
      "GFaceMD is a Wellesley, MA medical aesthetics practice founded by Dr. Gretchen Frieling, a Harvard-trained, triple board-certified dermatopathologist. The practice offers injectables, lasers, and skin-health treatments, using ultrasound guidance for precise, safety-focused results.",
    hours: H(["09:00", "16:00"], null, null),
    instagram_url: "https://instagram.com/gfacemd",
    facebook_url: "https://facebook.com/gfacemd",
    tiktok_url: null,
    youtube_url: "https://www.youtube.com/channel/UCKnOa0_4LZnZm1YSEPiT0fg",
    linkedin_url: "https://www.linkedin.com/in/gfacemd/",
    yelp_url: "https://www.yelp.com/biz/gretchen-w-frieling-md-wellesley",
    google_maps_url: null,
    stat_experts: "8",
    stat_treatments: "60+",
    stat_patients: "10k+",
    stat_cities: "4",
    featured: true,
    reviewsTarget: 22,
    fallbackLat: 42.2968,
    fallbackLng: -71.2924,
  },
  {
    id: "422e3ae6-fa9c-4302-8d47-aa9bc88b61d3",
    name: "Glo Derma Aesthetics & Wellness",
    street: "204 Floral Vale Blvd",
    city: "Yardley",
    state: "PA",
    zip: "19067",
    phone: "267-399-3456",
    email: "clientservices@gloderma.com",
    booking_url: "https://gloderma.myaestheticrecord.com/online-booking",
    founded_year: 2017,
    tagline: "It's not about perfection — it's about feeling like the best you.",
    about:
      "Glo Derma is a full-service medical spa in Yardley, PA offering injectables, laser treatments, facials, and wellness services. Founded by aesthetic nurse Amy Lynn, RN, CANS, it's built on a no-judgment, come-as-you-are experience delivered by a team of medically trained professionals.",
    hours: H(["09:00", "17:00"], ["09:00", "15:00"], null),
    instagram_url: "https://www.instagram.com/gloderma/",
    facebook_url: "https://www.facebook.com/GLODerma/",
    tiktok_url: "https://www.tiktok.com/@gloderma",
    youtube_url: null,
    linkedin_url:
      "https://www.linkedin.com/company/glo-derma-aesthetics-and-wellness",
    yelp_url: "https://www.yelp.com/biz/glo-derma-aesthetics-and-wellness-yardley",
    google_maps_url: null,
    stat_experts: "7",
    stat_treatments: "26+",
    stat_patients: "6k+",
    stat_cities: null,
    featured: false,
    reviewsTarget: 18,
    fallbackLat: 40.238,
    fallbackLng: -74.849,
  },
  {
    id: "7497072e-4cee-4f4a-87f8-ab0c278d4f70",
    name: "JSJ Aesthetics Co.",
    street: "34 Lowell Rd",
    city: "Salem",
    state: "NH",
    zip: "03079",
    phone: "603-212-6530",
    email: "contact@jsjaesthetics.com",
    booking_url: "https://jsjaesthetics.com/",
    founded_year: 2019,
    tagline: "Medical aesthetics and wellness led by nurse practitioner Jessica St. Jean.",
    about:
      "JSJ Aesthetics is a medical spa in Salem, NH founded by family nurse practitioner Jessica St. Jean, offering injectables, laser treatments, facials, and IV and wellness therapies. The practice focuses on enhancing natural features and supporting long-term skin health across its Salem, NH and Medford, MA locations.",
    hours: H(["10:00", "19:00"], ["10:00", "16:00"], null),
    instagram_url: "https://www.instagram.com/jsjaesthetics/",
    facebook_url: "https://www.facebook.com/jsjaesthetics/",
    tiktok_url: "https://www.tiktok.com/@jsjaesthetics_",
    youtube_url: null,
    linkedin_url: "https://www.linkedin.com/company/jsj-aesthetics",
    yelp_url: "https://www.yelp.com/biz/jsj-aesthetics-salem",
    google_maps_url: "https://maps.app.goo.gl/woBXaDMY5R4FaRBJA",
    stat_experts: "8",
    stat_treatments: "60+",
    stat_patients: "9k+",
    stat_cities: "2",
    featured: false,
    reviewsTarget: 20,
    fallbackLat: 42.79,
    fallbackLng: -71.217,
  },
  {
    id: "ab355e88-45c5-4215-b630-a6f30f950754",
    name: "RUMA Aesthetics & Wellness",
    street: "1850 W Ashton Blvd Ste 100",
    city: "Lehi",
    state: "UT",
    zip: "84043",
    phone: "801-514-7650",
    email: "info@ruma.com",
    booking_url: "https://ruma.com",
    founded_year: 2018,
    tagline:
      "Personalized aesthetics, wellness, and regenerative medicine for natural results.",
    about:
      "RUMA Aesthetics & Wellness is a Lehi, Utah practice founded in 2018 by nurse practitioner Shelby Miller, DNP, FNP-C. It offers cosmetic injectables, skin health, functional and regenerative wellness, and intimate wellness with a focus on natural-looking results.",
    hours: H(["09:00", "17:00"], null, null),
    instagram_url: "https://www.instagram.com/ruma.medical/",
    facebook_url: "https://www.facebook.com/rumaaesthetics/",
    tiktok_url: "https://www.tiktok.com/@ruma.medical",
    youtube_url: null,
    linkedin_url: "https://www.linkedin.com/company/ruma-medical-aesthetics",
    yelp_url: "https://www.yelp.com/biz/ruma-medical-lehi",
    google_maps_url: "https://maps.app.goo.gl/cxiocbj2TXmsqBCD6",
    stat_experts: "23",
    stat_treatments: "49+",
    stat_patients: "14k+",
    stat_cities: null,
    featured: true,
    reviewsTarget: 24,
    fallbackLat: 40.418,
    fallbackLng: -111.893,
  },
  {
    id: "ea09ddcb-aff8-4ba6-b357-2a9760b5ff4d",
    street: "2360 McKee Road Suite 10",
    city: "San Jose",
    state: "CA",
    zip: "95116",
    phone: "408-770-9897",
    email: "info@sanjosemedspa.com",
    booking_url: "https://www.sanjosemedspa.com/schedule",
    founded_year: 2016,
    tagline:
      "Northern California's largest med spa — physician-led, nonsurgical aesthetics.",
    about:
      "San Jose Medical Spa is a physician-owned, nonsurgical aesthetic clinic led by Medical Director Dr. Maggie Chen. Operating since 2016, it has performed over 20,000 treatments and is one of the largest aesthetic clinics in Northern California, offering skin rejuvenation, body contouring, laser hair removal, and anti-aging procedures.",
    hours: H(["09:00", "17:30"], null, null),
    instagram_url: "https://www.instagram.com/sanjosemedspa/",
    facebook_url: "https://www.facebook.com/p/San-Jose-Medical-Spa-100054204954930/",
    tiktok_url: null,
    youtube_url: null,
    linkedin_url: null,
    yelp_url: "https://www.yelp.com/biz/san-jose-medical-spa-san-jose",
    google_maps_url:
      "https://www.google.com/maps?q=2360+McKee+Road,+San+Jose,+CA+95116",
    stat_experts: "23",
    stat_treatments: "54+",
    stat_patients: "20k+",
    stat_cities: null,
    featured: true,
    reviewsTarget: 23,
    fallbackLat: 37.369,
    fallbackLng: -121.848,
  },
  {
    id: "f36a52c5-ea2a-4c30-bbee-c498ba331118",
    street: "2438 Research Pkwy #100",
    city: "Colorado Springs",
    state: "CO",
    zip: "80920",
    phone: "719-535-9990",
    email: "info@instituteofplastics.com",
    booking_url: "https://instituteofplastics.com/contact",
    founded_year: 2004,
    tagline:
      "Board-certified plastic surgery and med spa care in Colorado Springs since 2004.",
    about:
      "The Institute of Plastic Surgery is a Colorado Springs cosmetic and reconstructive practice led by board-certified plastic surgeon Dr. Krishna S. Dash. It offers surgical and non-surgical treatments with personalized, patient-first care.",
    hours: H(["08:00", "17:00"], null, null),
    instagram_url: "https://www.instagram.com/instituteofplastics/",
    facebook_url:
      "https://www.facebook.com/people/Institute-of-Plastic-Surgery/61574852694445/",
    tiktok_url: null,
    youtube_url: null,
    linkedin_url: null,
    yelp_url:
      "https://www.yelp.com/biz/institute-of-plastic-surgery-colorado-springs-2",
    google_maps_url: "https://maps.app.goo.gl/wzsyBsrDtgw6KqwSA",
    stat_experts: "12",
    stat_treatments: "70+",
    stat_patients: "15k+",
    stat_cities: null,
    featured: false,
    reviewsTarget: 18,
    fallbackLat: 38.943,
    fallbackLng: -104.777,
  },
  {
    id: "44678b65-033f-4202-b813-7f85f28cb3c4",
    street: "1701 N Green Valley Pkwy Suite 5A",
    city: "Henderson",
    state: "NV",
    zip: "89074",
    phone: "702-852-3110",
    email: "reception@trubeautymedspa.com",
    booking_url: "https://book.mypatientnow.com/practice/py85x9",
    founded_year: 2017,
    tagline: "Cosmetic injectables, lasers, and skincare in Henderson — because you're worth it.",
    about:
      "Tru Beauty By Trevor is an award-winning Henderson, NV med spa offering cosmetic injectables, laser treatments, facials, and skincare. Led by owner and elite injector Trevor Larsen, RN, the team emphasizes personalized care, safety, and self-love.",
    hours: H(["09:00", "17:00"], null, null),
    instagram_url: "https://www.instagram.com/trubeautymedspa/",
    facebook_url: "https://www.facebook.com/trubeautybytrevor",
    tiktok_url: "https://www.tiktok.com/@trubeautymedspa",
    youtube_url: "https://www.youtube.com/@TruBeautyMedSpa",
    linkedin_url: null,
    yelp_url: "https://www.yelp.com/biz/tru-beauty-by-trevor-henderson",
    google_maps_url: null,
    stat_experts: "6",
    stat_treatments: "56+",
    stat_patients: "7k+",
    stat_cities: "2",
    featured: false,
    reviewsTarget: 18,
    fallbackLat: 36.049,
    fallbackLng: -115.068,
  },
];

// ── Review generation ────────────────────────────────────────────────────────

const REVIEWER_NAMES = [
  "Jessica M.", "Ashley R.", "Emily T.", "Sarah K.", "Rachel B.", "Megan L.",
  "Amanda C.", "Nicole P.", "Lauren D.", "Stephanie H.", "Brittany S.", "Danielle W.",
  "Katie F.", "Hannah G.", "Samantha J.", "Victoria N.", "Olivia A.", "Sophia V.",
  "Madison E.", "Chloe R.", "Grace M.", "Natalie O.", "Kayla B.", "Alyssa T.",
  "Jennifer W.", "Michelle L.", "Christina P.", "Heather D.", "Melissa K.", "Andrea S.",
  "Maria G.", "Kelly R.", "Erica H.", "Diana C.", "Vanessa M.", "Taylor B.",
  "Jordan P.", "Morgan L.", "Cassie D.", "Paige W.", "Sydney R.", "Julia K.",
  "Marcus T.", "David L.", "Ryan P.", "Brian K.", "Anthony M.", "Kevin R.",
  "Daniel S.", "Christopher B.", "Robert H.", "Michael D.", "James W.", "Jason C.",
  "Amber N.", "Whitney F.", "Brooke A.", "Leah S.", "Gabriela M.", "Renee T.",
];

const TREATMENTS = [
  "Botox", "lip filler", "dermal filler", "laser hair removal", "HydraFacial",
  "microneedling", "chemical peel", "CoolSculpting", "Morpheus8", "PRP microneedling",
  "laser skin resurfacing", "Dysport", "vampire facial", "IV therapy",
  "body contouring", "signature facial", "cheek filler", "under-eye filler",
];

// Templates use {t} = treatment, {c} = city. Written to sound like real patients.
// {t} is always the bare treatment name and only ever appears in possessive /
// "my {t} appointment" style contexts, so the grammar reads naturally.
const TEMPLATES = [
  "I came in for my {t} appointment and could not be happier with the results. The whole team is warm, professional, and made me feel completely at ease.",
  "Best med spa in {c}, hands down. My {t} looked so natural and no one could tell I had anything done — just that I looked more rested.",
  "I was nervous about my first appointment but they walked me through everything. My {t} turned out beautifully and I've already booked my next visit.",
  "Absolutely love this place. The results from my {t} exceeded my expectations and the space is spotless and relaxing.",
  "Highly recommend! I've been coming here for my {t} for over a year and the consistency and care are unmatched.",
  "The consultation was thorough and honest — they never push extra services. My {t} results speak for themselves.",
  "Such a welcoming environment. I had my {t} done and the follow-up care afterward was fantastic. I feel so much more confident.",
  "Ten out of ten. The staff genuinely listens to what you want. My {t} looks amazing and healed perfectly.",
  "I drove over an hour for my {t} appointment and it was worth every minute. Truly the best in {c}.",
  "Clean, modern, and professional. My {t} was painless and the results were exactly what I hoped for.",
  "I finally found my go-to spot. Booked my {t} on a friend's recommendation and now I send everyone here.",
  "The attention to detail is incredible. My {t} was customized to my face and the outcome looks so natural.",
  "Friendly staff, gorgeous office, and real results. My {t} made a noticeable difference within days.",
  "They take the time to explain your options and never rush you. Thrilled with my {t} — will be back!",
  "From the front desk to the treatment room, everyone is kind and knowledgeable. My {t} results are subtle and beautiful.",
  "This place is a hidden gem in {c}. My {t} was flawless and the pricing was fair and transparent.",
  "I've had my {t} done at other places before, but the quality here is on another level. So happy I switched.",
  "Wonderful experience start to finish. My {t} looks natural and refreshed — exactly what I wanted.",
  "Cannot say enough good things. My {t} completely boosted my confidence and the team made it a fun experience.",
  "Professional, honest, and talented. I trust them completely with my {t} and my skin has never looked better.",
  "The results from my {t} lasted longer than I expected and looked great the entire time. Booking again for sure.",
  "Every visit feels personalized. My {t} was quick, comfortable, and the results are natural and glowing.",
  "I appreciate how they prioritize safety and never overdo it. My {t} looks tasteful and age-appropriate.",
  "A five-star experience. The provider was gentle and precise with my {t}, and I felt cared for the whole time.",
];

/** Deterministic pick — same output every run so the script is idempotent. */
function buildReviews(clinicIndex: number, seed: ClinicSeed) {
  const out: { rating: number; body: string; reviewer_name: string }[] = [];
  const n = seed.reviewsTarget;
  for (let j = 0; j < n; j++) {
    const name = REVIEWER_NAMES[(clinicIndex * 7 + j) % REVIEWER_NAMES.length];
    const tmpl = TEMPLATES[(clinicIndex * 5 + j) % TEMPLATES.length];
    const treatment = TREATMENTS[(clinicIndex * 3 + j) % TREATMENTS.length];
    const body = tmpl.replace("{t}", treatment).replace("{c}", seed.city);
    // Mostly 5-star, roughly 1 in 5 is a 4 → avg ~4.8.
    const rating = j % 5 === 4 ? 4 : 5;
    out.push({ rating, body, reviewer_name: name });
  }
  return out;
}

// ── Long-form "about" copy ──────────────────────────────────────────────────
// Expanded (~5x) descriptions used on the clinic detail page. Keyed by clinic id.
// These OVERRIDE the short `about` in the CLINICS array above so the enrichment
// stays consistent on a full re-run. Grounded in verified facts (founders, city,
// services) with descriptive demo filler.
const LONG_ABOUTS: Record<string, string> = {
  "1e0477ea-1a01-4eff-ae85-a5eff0529c7f": `Aesthetic Artistry is a woman-owned medical spa in Burke, Virginia, led by master injector Therese Persson, RN, whose Scandinavian eye for balance and proportion shapes every treatment plan. The practice specializes in neurotoxins such as Botox and Dysport, soft dermal fillers, PRX-T33 skin revitalization, medical-grade chemical peels, and collagen-boosting microneedling. Therese and her team believe the best aesthetic work is the kind no one can quite put their finger on — you simply look rested, refreshed, and like the most confident version of yourself. Every visit begins with an unhurried consultation, where your facial anatomy, goals, and comfort level are discussed in detail before any treatment is recommended. Rather than pushing one-size-fits-all packages, the studio designs long-term roadmaps that evolve with your skin over time, prioritizing subtle, natural-looking results and healthy skin above all else. The environment is intentionally warm and private, a welcome contrast to high-volume clinics, so that first-timers and seasoned patients alike feel genuinely cared for. From preventative "baby Botox" for younger clients to full-face rejuvenation for those seeking a more dramatic refresh, Aesthetic Artistry combines advanced training, artistry, and an honest, education-first approach. Patients across Northern Virginia return again and again for the personal attention, meticulous technique, and the reassuring sense that their face is in expert hands.`,
  "925a650b-7f87-47ea-8b48-4669133cfb6f": `Aesthetic Medical Lounge blends science, artistry, and holistic medicine to deliver a med spa experience unlike anything else on Long Island. Founded by medical aesthetician Denise King, the Long Beach, New York studio was built on a simple philosophy — radiance fit for a queen, confidence built for a king — and welcomes clients of every background who want to look and feel their best. The menu spans advanced aesthetics such as RF microneedling, dermal fillers, neurotoxins, and non-invasive body contouring, alongside wellness offerings like acupuncture and restorative therapies that treat the whole person rather than a single concern. Denise and her team take a consultative, unhurried approach, mapping out personalized treatment plans that consider your skin, your lifestyle, and your long-term goals. The space itself is designed to feel like a calm coastal escape — a place to slow down, exhale, and invest in yourself. Whether you are exploring your very first treatment or maintaining results you already love, you will find a team that prioritizes safety, natural-looking outcomes, and genuine relationships over quick fixes. Clients consistently praise the lounge for its warm, judgment-free atmosphere and its rare ability to combine cutting-edge medical aesthetics with a truly holistic, whole-body sensibility. It is beauty and wellness, thoughtfully brought together under one roof.`,
  "5515629c-ef5d-4545-87bf-06b3528d88da": `Aesthetica Medical Spa is a state-recognized medical spa in Kalispell, Montana, and one of the most trusted names for aesthetic care in the Flathead Valley. Founded by nurse practitioner Rachael Alsbury, the practice has earned recognition as one of Allergan's Top 10 Med Spas in Montana — a reflection of both its clinical expertise and its loyal patient following. The team specializes in graceful aging and natural beauty, offering customized treatments that include Botox and Dysport, dermal fillers, medical-grade facials, laser hair removal, body and weight-loss solutions, and results-driven skincare. Rachael brings decades of combined medical and aesthetic experience to every plan, and the philosophy here is never about chasing trends or dramatic transformations — it is about helping you feel like the most vibrant version of yourself at every stage of life. Each journey starts with a thorough consultation to understand your concerns, your goals, and the results you hope to maintain over time. The clinic pairs advanced technology with a genuinely personal touch, and its Montana clientele returns for the honest guidance, meticulous technique, and welcoming atmosphere. From subtle preventative care to comprehensive rejuvenation, Aesthetica is committed to healthy, glowing skin and treatments tailored precisely to you. It is boutique, expert care in the heart of Kalispell.`,
  "ac5b505f-41cf-4d99-9aad-9c804522f31c": `Beauty Lab + Laser is one of Utah's most recognized medical aesthetics practices, with flagship locations in Murray and Riverton and a reputation that reaches well beyond the state. Founded by Heather Gay and Andrea Robinson, the practice pairs a fun, unpretentious culture with serious clinical expertise, and its team of nurses and providers has performed thousands of treatments across every category of modern aesthetics. Patients come for laser skin therapies, injectables like Botox and filler, collagen-stimulating biostimulators, medical-grade facials, and a growing menu of wellness treatments — all delivered with a focus on natural-looking, confidence-boosting results. What sets Beauty Lab apart is its "led by expertise, focused on you" ethos: every appointment begins with a genuine conversation, not a sales pitch, and treatment plans are built around your anatomy, your goals, and your budget. The studios are bright, modern, and welcoming, designed so that first-time clients feel just as comfortable as longtime regulars. Whether you are starting with a single laser session or building a long-term skin-health routine, the team takes the time to educate you on your options and set realistic expectations. With extended evening and weekend hours across two locations, Beauty Lab + Laser has made high-quality medical aesthetics accessible, approachable, and genuinely enjoyable for clients throughout the Salt Lake Valley.`,
  "e9fb2610-9a1c-4698-9bb5-e15656ec9d1d": `Beauty at the Lake is a women-owned medical spa in the heart of downtown Coeur d'Alene, Idaho, where advanced aesthetics meet the warmth of a small-town practice. Co-founded in 2019, the clinic has grown from a passion project into one of the region's most beloved destinations for looking and feeling your best. The team offers an unusually complete menu — injectables such as Botox and dermal fillers, medical-grade facials, laser treatments, body sculpting, medical weight loss, and relaxing massage — so that clients can address multiple goals under one roof. Every treatment is grounded in a philosophy of natural results and genuine care: the providers take time to listen, to educate, and to design plans that enhance your features rather than change who you are. The space is bright, welcoming, and unmistakably local, and the team has built a reputation for follow-up care that goes well beyond the appointment itself. From clients seeking their first subtle refresh to those maintaining long-term skin health, Beauty at the Lake meets everyone with the same attentive, judgment-free approach. Its downtown location makes it easy to pair a treatment with a walk along the lake, and its loyal following reflects years of consistent, results-driven work. This is boutique medical aesthetics with heart, delivered by a team that treats clients like neighbors.`,
  "034caec0-86d2-404e-bc8f-f89aa86191a1": `Cherry Medical Aesthetics is a boutique med spa nestled in Denver's vibrant LoHi (Lower Highlands) neighborhood, founded by co-owners Cheryl and Stacy on the belief that great aesthetic care should feel personal, honest, and a little bit fun. The practice takes a three-dimensional approach to skin — treating tone, texture, and structure together — with a menu that spans injectables such as Botox and dermal fillers, laser treatments, microneedling with PRP, chemical peels, HydraFacial, Sciton BBL, and non-invasive body contouring. Rather than pushing packages, the team focuses on building relationships and long-term skin-health plans, taking the time to understand each client's concerns, lifestyle, and goals before recommending anything. The result is a loyal Denver following that trusts Cherry for natural-looking outcomes and straightforward guidance. The studio itself is stylish and welcoming, an inviting space where first-timers feel at ease and regulars feel at home. Whether you are exploring preventative treatments in your twenties or seeking comprehensive rejuvenation later on, the providers meet you where you are, prioritizing safety, education, and results that enhance rather than overhaul. Open six days a week, Cherry Medical Aesthetics has become a neighborhood staple for anyone who wants to look and feel their best without the pressure or pretension of a high-volume clinic. It is expert medical aesthetics with a distinctly Denver spirit.`,
  "f21a5fab-8e7b-4ec9-b230-b7abf43b5ee6": `Exhibit Medical Aesthetics is a state-of-the-art medical spa in Denville, New Jersey, founded by nurse practitioner Nicole Bauer and physician assistant Melissa LaMarca with a mission to redefine the med spa experience. Their signature philosophy centers on "whole-face care" — the idea that beautiful, natural results come from treating the face as a complete canvas rather than chasing isolated fixes. The practice offers Botox and neurotoxins, dermal fillers, medical-grade facials, microneedling, and advanced skincare, all delivered with an uncompromising emphasis on patient safety and artistry. Nicole and Melissa combine deep clinical training with a genuine eye for aesthetics, and every treatment begins with an honest, education-first consultation designed to set realistic expectations and build trust. Clients describe the atmosphere as modern, welcoming, and refreshingly free of pressure — a place where questions are encouraged and comfort is a priority. Whether you are new to injectables or a seasoned patient looking for a provider who truly listens, Exhibit's team is committed to results that look like you on your best day: refreshed, balanced, and never overdone. The clinic has quickly built a devoted local following in Morris County, drawn by its blend of technical precision, warm hospitality, and a treatment philosophy that puts long-term facial harmony ahead of quick trends. This is medical aesthetics done thoughtfully, safely, and beautifully.`,
  "600f4615-1755-49cf-a778-f1ceded9cdd5": `Forever Beauty Med Spa is a boutique medical spa in Salt Lake City, Utah, built on a simple but powerful idea: you should look as confident and radiant on the outside as you feel on the inside. The practice offers a well-rounded menu of aesthetic services, including injectables such as Botox and dermal fillers, rejuvenating facials, laser treatments, and permanent-makeup micropigmentation, so that clients can refresh and enhance their natural features in one welcoming place. What defines Forever Beauty is its deeply personalized approach — the team believes no two clients are alike, so every treatment plan is customized to your unique anatomy, skin, and goals rather than pulled from a template. Appointments begin with a thoughtful consultation, and the providers take pride in educating clients so they feel informed and empowered at every step. The studio's atmosphere is warm and unpretentious, designed to make both newcomers and returning clients feel genuinely at ease. From subtle, preventative enhancements to more comprehensive rejuvenation, the emphasis is always on natural-looking results that boost confidence without looking overdone. With flexible hours six days a week and a team that treats clients like family, Forever Beauty has become a trusted destination for aesthetic care in the Salt Lake City area — a place where self-care, artistry, and lasting confidence come together.`,
  "e1e76e86-d72a-4f05-9682-67f132f48cc7": `GFaceMD is a premier medical aesthetics practice in Wellesley, Massachusetts, founded by Dr. Gretchen Frieling — known to her patients as "Dr. G" — a Harvard-trained, triple board-certified dermatopathologist. Dr. Frieling's rare combination of expertise in skin pathology and aesthetic medicine informs everything the practice does, resulting in a level of precision and safety that discerning Boston-area patients seek out. GFaceMD specializes in injectables, laser treatments, and comprehensive skin-health protocols, and is especially recognized for its ultrasound-guided injection technique, which maps the underlying anatomy for exceptionally accurate, natural-looking results. The philosophy here is deeply rooted in the science of the skin: rather than simply masking concerns, Dr. G and her team address the health and structure of the skin itself, tailoring each plan to the individual. Consultations are thorough and education-forward, empowering clients to make confident, informed decisions about their care. The practice's Wellesley location offers a refined, welcoming environment, and its reputation has drawn a loyal following from across Greater Boston and beyond. Whether you are seeking preventative treatments, subtle enhancement, or advanced rejuvenation, GFaceMD pairs medical rigor with a genuine artistic sensibility. For patients who want their aesthetic care overseen by a physician with elite credentials and a meticulous, safety-first approach, GFaceMD has become one of the most trusted names in the region.`,
  "422e3ae6-fa9c-4302-8d47-aa9bc88b61d3": `Glo Derma Aesthetics & Wellness is a full-service medical spa in Yardley, Pennsylvania, founded by aesthetic nurse Amy Lynn, RN, CANS, on a refreshingly human philosophy: it's not about perfection, it's about feeling like the best version of yourself. From the moment you walk in, the practice is defined by a no-judgment, come-as-you-are experience, where clients of every age and background are welcomed by a team of medically trained professionals. The menu is comprehensive, spanning injectables such as Botox and dermal fillers, laser treatments, medical-grade facials, and a range of wellness services designed to support both how you look and how you feel. Amy and her team believe that trust is the foundation of great aesthetic work, so every visit starts with an honest conversation about your goals, your concerns, and what will realistically help you glow. Named among the area's best med spas year after year since opening in 2017, Glo Derma has built a devoted Bucks County following on the strength of natural-looking results and genuinely warm care. The space is modern and inviting, and the emphasis throughout is on education, safety, and long-term skin health rather than quick fixes. Whether you are booking your first treatment or maintaining a long-standing routine, Glo Derma offers expert care delivered with kindness, confidence, and a signature glow.`,
  "7497072e-4cee-4f4a-87f8-ab0c278d4f70": `JSJ Aesthetics is a medical spa founded by family nurse practitioner Jessica St. Jean, serving clients across its Salem, New Hampshire and Medford, Massachusetts locations. Built on Jessica's belief that aesthetic care should enhance your natural features rather than mask them, the practice has earned a devoted following for its natural-looking results and genuinely personal approach. The menu is extensive, spanning injectables such as Botox and dermal fillers, laser treatments, medical-grade facials, and a full range of IV and wellness therapies that support beauty from the inside out. Every client relationship begins with a detailed consultation, where Jessica and her team take the time to understand your goals, assess your skin, and design a plan that supports long-term skin health rather than a one-time fix. The studios are modern, comfortable, and welcoming, and the team has cultivated a reputation for making even first-time patients feel confident and cared for. Whether you are exploring preventative treatments, refreshing your look, or investing in ongoing wellness, JSJ pairs advanced technique with an education-first philosophy that prioritizes your comfort and trust. With two locations spanning the New Hampshire and Massachusetts border, the practice has made expert aesthetic care convenient and accessible for clients throughout the region. It is boutique medical aesthetics with a warm, personal touch — the kind of place clients happily recommend to their friends.`,
  "ab355e88-45c5-4215-b630-a6f30f950754": `RUMA Aesthetics & Wellness is a premier Lehi, Utah practice founded in 2018 by nurse practitioner Shelby Miller, DNP, FNP-C, and has grown into one of the state's most respected destinations for aesthetics and integrative wellness. Far more than a traditional med spa, RUMA takes a whole-person approach, uniting cosmetic injectables and advanced skin health with functional and regenerative wellness, hormone optimization, and intimate wellness — all under one elevated roof. The philosophy is rooted in natural-looking, personalized results: Shelby and her team of expert providers begin every relationship with a comprehensive consultation, considering not just how you want to look but how you want to feel and function. Treatments range from Botox, dermal fillers, and biostimulators to medical-grade skin therapies and cutting-edge regenerative protocols, each tailored precisely to the individual. RUMA is also home to a respected training academy, a reflection of the practice's leadership within the broader aesthetics community and its commitment to the highest standards of technique and safety. The clinic's beautifully designed space and warm, knowledgeable team have earned a loyal following throughout Utah County and beyond. Whether you are seeking subtle enhancement, comprehensive rejuvenation, or a deeper investment in your long-term health and vitality, RUMA offers a rare combination of clinical expertise, artistry, and genuine care. It is aesthetics and wellness, thoughtfully integrated.`,
  "ea09ddcb-aff8-4ba6-b357-2a9760b5ff4d": `San Jose Medical Spa is a physician-owned, nonsurgical aesthetic clinic and one of the largest of its kind in Northern California, led by Medical Director Dr. Maggie Chen. Operating since 2016, the practice has performed well over 20,000 treatments, building a reputation for expertise, consistency, and results across a remarkably broad menu of services. Clients come for skin rejuvenation, body contouring, laser hair removal, injectables, and a comprehensive range of anti-aging procedures — all delivered under direct physician oversight, which sets the clinic apart from many med spas in the region. Dr. Chen and her team combine advanced technology with a meticulous, evidence-based approach, and every treatment plan is customized after a thorough consultation that prioritizes safety and realistic expectations. The scale of the practice means clients benefit from a depth of experience and a range of devices and modalities that smaller studios simply cannot match, while the team works hard to keep the experience personal and attentive. Whether you are addressing sun damage, unwanted hair, stubborn fat, or the natural signs of aging, San Jose Medical Spa offers a one-stop destination backed by genuine medical credentials. Its longevity, high treatment volume, and loyal patient base speak to a track record few can rival in the South Bay. For nonsurgical aesthetics guided by a physician, it remains one of San Jose's most trusted names.`,
  "f36a52c5-ea2a-4c30-bbee-c498ba331118": `The Institute of Plastic Surgery is a distinguished cosmetic and reconstructive practice in Colorado Springs, Colorado, led by board-certified plastic surgeon Dr. Krishna S. Dash. Established in 2004, the Institute has spent two decades earning the trust of patients across southern Colorado through a rare combination of surgical excellence and a genuinely patient-first philosophy. The practice offers a full spectrum of care, from advanced surgical procedures for the breast, body, and face to an extensive menu of non-surgical med spa treatments including injectables, laser therapies, and medical-grade skincare — allowing patients to pursue their goals along a complete continuum of options. Dr. Dash and his team are known for taking the time to listen, to educate, and to craft individualized treatment plans that align with each patient's anatomy, lifestyle, and aesthetic vision. Safety, natural-looking results, and long-term patient relationships are at the core of everything the Institute does. The environment is professional yet welcoming, designed to put patients at ease whether they are exploring a subtle non-surgical refresh or considering a significant surgical procedure. With board-certified expertise, state-of-the-art facilities, and a legacy that now spans more than twenty years, The Institute of Plastic Surgery has become a cornerstone of aesthetic and reconstructive medicine in the Colorado Springs community. It is comprehensive, credentialed care delivered with precision and genuine compassion.`,
  "44678b65-033f-4202-b813-7f85f28cb3c4": `Tru Beauty By Trevor is an award-winning medical spa in Henderson, Nevada, led by owner and elite injector Trevor Larsen, RN. Serving the greater Henderson and Las Vegas area, the practice has built its reputation on a distinctive blend of technical mastery and a genuinely uplifting client experience — captured in its guiding belief that self-care is worth it, because you're worth it. Trevor and his team specialize in cosmetic injectables such as Botox and dermal fillers, with particular acclaim for lip flips, lip and cheek enhancement, and full-face balancing, alongside laser treatments, medical-grade facials, and results-driven skincare. Every appointment is grounded in a philosophy of personalized care, safety, and self-love: the team takes time to understand your goals, explain your options honestly, and deliver refreshed, natural-looking results that never appear overdone. The studio is stylish, welcoming, and energetic, an environment where clients feel celebrated rather than judged. As an elite injector, Trevor brings advanced training and an artist's eye to even the most subtle treatment, and his loyal Las Vegas Valley following reflects years of consistent, high-quality work. Whether you are booking your very first treatment or maintaining a look you love, Tru Beauty By Trevor pairs expert technique with warmth and encouragement. It is award-winning aesthetics with heart — a place designed to help you leave feeling like the truest, most confident version of yourself.`,
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🩺 Enriching ${CLINICS.length} clinics for the demo...\n`);
  let ok = 0;
  let geocoded = 0;

  for (let i = 0; i < CLINICS.length; i++) {
    // Long-form about copy (if present) overrides the short inline version.
    const c = { ...CLINICS[i], about: LONG_ABOUTS[CLINICS[i].id] ?? CLINICS[i].about };
    const address = `${c.street}, ${c.city}, ${c.state} ${c.zip}`;

    // 1) Coordinates: try live geocoding, fall back to hardcoded approx.
    let lat = c.fallbackLat;
    let lng = c.fallbackLng;
    let coordSource = "fallback";
    try {
      const geo = await geocodeAddress(address);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        coordSource = "geocoded";
        geocoded++;
      }
    } catch {
      /* keep fallback */
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 2) Update the clinic row.
      await client.query(
        `UPDATE clinics SET
           name = COALESCE($2, name),
           address = $3, city = $4, state = $5, zip = $6, country = 'US',
           phone = $7, email = $8, booking_url = $9,
           tagline = $10, about = $11, founded_year = $12,
           hours = $13::jsonb,
           instagram_url = $14, facebook_url = $15, tiktok_url = $16,
           youtube_url = $17, linkedin_url = $18, yelp_url = $19,
           google_maps_url = $20,
           lat = $21::float8::numeric, lng = $22::float8::numeric,
           geo = ST_SetSRID(ST_MakePoint($22::float8, $21::float8), 4326)::geography,
           stat_experts = $23, stat_treatments = $24, stat_patients = $25,
           stat_cities = $26, stat_rating = NULL,
           ext_rating = NULL, ext_review_count = NULL,
           verified = TRUE, featured = $27, is_active = TRUE,
           updated_at = NOW()
         WHERE id = $1`,
        [
          c.id, c.name ?? null, address, c.city, c.state, c.zip,
          c.phone, c.email, c.booking_url,
          c.tagline, c.about, c.founded_year,
          JSON.stringify(c.hours),
          c.instagram_url, c.facebook_url, c.tiktok_url,
          c.youtube_url, c.linkedin_url, c.yelp_url,
          c.google_maps_url,
          lat, lng,
          c.stat_experts, c.stat_treatments, c.stat_patients,
          c.stat_cities, c.featured,
        ]
      );

      // 3) Regenerate reviews (idempotent: clear then insert).
      await client.query(`DELETE FROM reviews WHERE clinic_id = $1`, [c.id]);
      const reviews = buildReviews(i, c);
      for (const r of reviews) {
        await client.query(
          `INSERT INTO reviews
             (clinic_id, rating, body, reviewer_name, source, data_source,
              is_approved, is_active)
           VALUES ($1, $2, $3, $4, 'seed-demo', 'manual', TRUE, TRUE)`,
          [c.id, r.rating, r.body, r.reviewer_name]
        );
      }

      // stat_rating shows the headline average that the trigger just computed.
      await client.query(
        `UPDATE clinics
            SET stat_rating = to_char(avg_rating, 'FM990.0')
          WHERE id = $1 AND avg_rating IS NOT NULL`,
        [c.id]
      );

      await client.query("COMMIT");
      ok++;
      console.log(
        `  ✓ ${(c.name ?? "").padEnd(2)}${address.padEnd(52).slice(0, 52)} ` +
          `| ${reviews.length} reviews | coords ${coordSource} ${lat.toFixed(4)},${lng.toFixed(4)}`
      );
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`  ✗ ${c.id} failed:`, e instanceof Error ? e.message : e);
    } finally {
      client.release();
    }
  }

  // Summary
  const { rows } = await pool.query(
    `SELECT name, city, state, avg_rating, review_count, stat_rating
       FROM clinics ORDER BY name`
  );
  console.log(`\n✅ Done. ${ok}/${CLINICS.length} clinics updated, ${geocoded} live-geocoded.\n`);
  console.table(
    rows.map((r) => ({
      name: r.name,
      loc: `${r.city}, ${r.state}`,
      rating: r.avg_rating,
      reviews: r.review_count,
    }))
  );
  await pool.end();
}

main().catch(async (e) => {
  console.error("❌ demo-enrich-clinics failed:", e);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
