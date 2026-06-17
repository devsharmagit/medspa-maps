/**
 * test-scraper.ts — run with: bun scripts/test-scraper.ts [url]
 *
 * Quick smoke-test for the MedSpaMaps scraper + API shape logic.
 * Scrapes the provided URL (or defaults) and pretty-prints the DB-ready payload.
 *
 * Usage:
 *   bun scripts/test-scraper.ts abilenebeautybus.com
 *   bun scripts/test-scraper.ts 88aestheticandwellness.com
 *   bun scripts/test-scraper.ts a-biousa.com
 */

import { scrapeWebsite } from "../src/lib/scraper";

const rawUrl = process.argv[2] ?? "abilenebeautybus.com";
const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

console.log(`\n🕷  Scraping: ${url}\n`);

const result = await scrapeWebsite(url);

// ─── Shape into DB-ready payload (mirrors /api/scrape route logic) ────────────

function slugify(val: string): string {
  return val
    .toLowerCase()
    .replace(/[®™©°]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/, "");
}

function getDomain(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
}

const domain = getDomain(result.url);
const businessName =
  result.contact.name ??
  domain.split(".").slice(0, -1).join(" ").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

console.log("════════════════════════════════════════════════════════");
console.log(`BUSINESS: ${businessName}`);
console.log(`URL:      ${result.url}`);
console.log(`Scraped:  ${result.scraped_at}`);
console.log(`Pages:    ${result.pages_visited.join(", ")}`);
console.log("════════════════════════════════════════════════════════\n");

console.log(`📍 LOCATIONS (${result.locations.length}):`);
result.locations.forEach((loc, i) => {
  console.log(`  [${i + 1}] ${loc.name ?? "(unnamed)"}`);
  if (loc.address) console.log(`       Address: ${loc.address}`);
  if (loc.city)    console.log(`       City:    ${loc.city}, ${loc.state ?? ""} ${loc.zip ?? ""}`);
  if (loc.phone)   console.log(`       Phone:   ${loc.phone}`);
});

console.log(`\n🔧 SERVICES (${result.services.length}):`);
result.services.slice(0, 15).forEach((svc) => {
  const price = svc.price_from ? ` — $${svc.price_from}${svc.price_to ? `-$${svc.price_to}` : ""}` : "";
  console.log(`  • ${svc.name}${price}`);
});
if (result.services.length > 15) console.log(`  ... and ${result.services.length - 15} more`);

console.log(`\n🖼  IMAGES (${result.images.length}):`);
result.images.forEach((img) => {
  console.log(`  [${img.role}] ${img.source_url.slice(0, 80)}`);
  if (img.alt_text) console.log(`         alt: ${img.alt_text}`);
});

console.log(`\n📱 SOCIALS:`);
const c = result.contact;
if (c.instagram_url)  console.log(`  Instagram : ${c.instagram_url}`);
if (c.facebook_url)   console.log(`  Facebook  : ${c.facebook_url}`);
if (c.tiktok_url)     console.log(`  TikTok    : ${c.tiktok_url}`);
if (c.youtube_url)    console.log(`  YouTube   : ${c.youtube_url}`);
if (c.linkedin_url)   console.log(`  LinkedIn  : ${c.linkedin_url}`);
if (c.x_url)          console.log(`  X/Twitter : ${c.x_url}`);
if (c.yelp_url)       console.log(`  Yelp      : ${c.yelp_url}`);
if (c.google_my_business) console.log(`  GMB       : ${c.google_my_business}`);

console.log(`\n📞 CONTACT:`);
if (c.phone)   console.log(`  Phone   : ${c.phone}`);
if (c.email)   console.log(`  Email   : ${c.email}`);
if (c.address) console.log(`  Address : ${c.address}`);
if (c.about)   console.log(`  About   : ${c.about.slice(0, 120)}...`);

console.log("\n✅ Full DB-ready JSON:\n");

const payload = {
  scraped_at: result.scraped_at,
  source_url: result.url,
  pages_visited: result.pages_visited,
  business: {
    name: businessName,
    tier: "free",
    verified: false,
    data_source: "scraped",
    is_active: true,
  },
  clinics: result.locations.map((loc, i) => {
    const isMulti = result.locations.length > 1;
    const clinicName = isMulti && (loc.city ?? c.city)
      ? `${businessName} – ${loc.city ?? c.city}`
      : businessName;
    return {
      name: clinicName,
      slug: slugify(clinicName),
      website: result.url,
      booking_url: c.booking_url,
      address: loc.address ?? c.address,
      city: loc.city ?? c.city,
      state: loc.state ?? c.state,
      zip: loc.zip ?? c.zip,
      country: "US",
      phone: loc.phone ?? c.phone,
      email: loc.email ?? c.email,
      about: c.about,
      instagram_url: c.instagram_url,
      facebook_url: c.facebook_url,
      tiktok_url: c.tiktok_url,
      youtube_url: c.youtube_url,
      linkedin_url: c.linkedin_url,
      x_url: c.x_url,
      yelp_url: c.yelp_url,
      google_my_business: c.google_my_business,
      hours: loc.hours ?? c.hours,
      tier: "free",
      verified: false,
      featured: false,
      data_source: "scraped",
      last_scraped_at: result.scraped_at,
      is_active: true,
      services: result.services.map((svc) => ({
        raw_name: svc.name,
        slug: svc.slug,
        description: svc.description,
        price_from: svc.price_from,
        price_to: svc.price_to,
        price_notes: svc.price_notes,
        price_varies: svc.price_varies,
        duration_minutes: svc.duration_minutes,
        data_source: "scraped",
        scraped_from_url: result.url,
      })),
      images: result.images.filter(img => img.role !== "logo").map((img, idx) => ({
        entity_type: "clinic",
        source_url: img.source_url,
        role: img.role,
        alt_text: img.alt_text,
        sort_order: img.sort_order ?? idx,
        scraped_domain: domain,
        scrape_status: "pending",
      })),
    };
  }),
};

console.log(JSON.stringify(payload, null, 2));
