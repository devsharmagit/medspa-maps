/**
 * test-g99-overlay.ts — run with: bun scripts/test-g99-overlay.ts [url]
 *
 * Simulates a COMPLETE G99 clinic record (every field populated, as if it were
 * a real production business) and runs the REAL scraper + REAL overlay merge,
 * then prints a field-by-field provenance table (G99 vs scrape vs merged).
 *
 * We can't INSERT into the G99 DB (it's a read-only replica), so the complete
 * record is built here; the scrape + overlay are the exact production code.
 */

import { scrapeClinicPreview } from "../src/lib/admin/scrape-preview";
import { overlayG99 } from "../src/lib/g99/overlay";
import type { G99Clinic } from "../src/lib/g99/source";

const rawUrl = process.argv[2] ?? "ruma.com";
const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

// A fully-populated G99 clinic record — what a real, complete business looks like.
const completeG99: G99Clinic = {
  clinic_id: "999999",
  name: "RUMA Aesthetics — Lehi (G99 name)",
  website: url,
  address: "1850 W Ashton Blvd Ste 100, Lehi, UT 84043, USA",
  city: "Lehi",
  state: "Utah",
  country: "USA",
  contact_number: "8015551234",
  about: "G99-supplied description: premier medical aesthetics & wellness in Lehi, Utah.",
  google_my_business: "https://maps.google.com/?cid=1234567890",
  google_place_id: "ChIJxxxxxxxxxxxxxxxxxxxxxxx",
  google_profile_id: null,
  instagram: "https://www.instagram.com/ruma_g99",
  facebook: "https://www.facebook.com/ruma.g99",
  twitter: "https://twitter.com/ruma_g99",
  tiktok: "https://www.tiktok.com/@ruma_g99",
  yelp_url: "https://www.yelp.com/biz/ruma-aesthetics-lehi",
  appointment_url: "https://booking.ruma.com/g99",
  clinic_url: "https://devemr.growthemr.com/ap-booking?b=1&c=1",
};

const businessName = "RUMA Aesthetics (G99 business)";

function show(v: unknown): string {
  if (v == null || v === "") return "∅";
  const s = String(v);
  return s.length > 46 ? s.slice(0, 43) + "…" : s;
}

const run = async () => {
  console.log(`\n🕷  Scraping real site: ${url}\n`);
  const preview = await scrapeClinicPreview(url);

  // snapshot the scrape's own values BEFORE the overlay
  const scrapeLoc = { ...(preview.locations[0] ?? {}) } as Record<string, unknown>;
  const scrapeBizName = preview.business?.name ?? null;

  // run the REAL overlay
  const merged = overlayG99(structuredClone(preview), completeG99, businessName);
  const mLoc = merged.locations[0] as Record<string, unknown>;

  // field -> [scrapeValue, g99Value]
  const fields: Array<[string, unknown, unknown]> = [
    ["business name", scrapeBizName, completeG99.name],
    ["address", scrapeLoc.address, completeG99.address],
    ["city", scrapeLoc.city, completeG99.city],
    ["state", scrapeLoc.state, completeG99.state],
    ["zip", scrapeLoc.zip, "(from G99 address)"],
    ["phone", scrapeLoc.phone, completeG99.contact_number],
    ["about", scrapeLoc.about, completeG99.about],
    ["booking_url", scrapeLoc.booking_url, completeG99.appointment_url],
    ["maps_url", scrapeLoc.maps_url, completeG99.google_my_business],
    ["google_my_business", scrapeLoc.google_my_business, completeG99.google_my_business],
    ["instagram_url", scrapeLoc.instagram_url, completeG99.instagram],
    ["facebook_url", scrapeLoc.facebook_url, completeG99.facebook],
    ["tiktok_url", scrapeLoc.tiktok_url, completeG99.tiktok],
    ["x_url", scrapeLoc.x_url, completeG99.twitter],
    ["yelp_url", scrapeLoc.yelp_url, completeG99.yelp_url],
  ];

  const mergedByField: Record<string, unknown> = {
    "business name": merged.business?.name,
    address: mLoc.address, city: mLoc.city, state: mLoc.state, zip: mLoc.zip,
    phone: mLoc.phone, about: mLoc.about, booking_url: mLoc.booking_url,
    maps_url: mLoc.maps_url, google_my_business: mLoc.google_my_business,
    instagram_url: mLoc.instagram_url, facebook_url: mLoc.facebook_url,
    tiktok_url: mLoc.tiktok_url, x_url: mLoc.x_url, yelp_url: mLoc.yelp_url,
  };

  let fromScrape = 0, fromG99 = 0;
  console.log("FIELD                | SCRAPE FOUND                                  | G99 HAD                                        | MERGED → WINNER");
  console.log("-".repeat(160));
  for (const [name, scrapeV, g99V] of fields) {
    const mv = mergedByField[name];
    const scrapeHas = scrapeV != null && String(scrapeV).trim() !== "";
    let winner: string;
    if (scrapeHas && String(mv) === String(scrapeV)) { winner = "SCRAPE"; fromScrape++; }
    else if (mv != null && String(mv) !== "") { winner = "G99 (gap-fill)"; fromG99++; }
    else winner = "—";
    console.log(
      name.padEnd(20) + " | " + show(scrapeV).padEnd(45) + " | " + show(g99V).padEnd(46) + " | " + show(mv) + "  → " + winner
    );
  }

  console.log("-".repeat(160));
  console.log(`\nFIELD SOURCES:  ${fromScrape} from SCRAPE,  ${fromG99} from G99 (gap-fill)`);
  console.log("\nCOLLECTIONS (always 100% from the website scrape — G99 never supplies these):");
  console.log("  treatments/services :", preview.services.length, "  (e.g. " + preview.services.slice(0, 6).map((s) => s.raw_name).join(", ") + ")");
  console.log("  matched to canonical:", preview.services.filter((s) => s.suggestion?.slug).length);
  console.log("  concerns derived    :", preview.concerns.length);
  console.log("  gallery images      :", preview.images.gallery?.length ?? 0);
  console.log("  logo                :", preview.images.logo ? "yes" : "no");
  console.log("  reviews             :", preview.reviews.length, "| rating:", preview.ext_rating, "| count:", preview.ext_review_count);
  console.log("  lat/lng (geocoded)  :", scrapeLoc.lat, scrapeLoc.lng);
  console.log("\nG99-ONLY (the hard link stamped on save, never scraped):");
  console.log("  g99_clinic_id:", completeG99.clinic_id, "| google_place_id:", completeG99.google_place_id);
};

run().then(() => process.exit(0)).catch((e) => { console.error("ERR", e); process.exit(1); });
