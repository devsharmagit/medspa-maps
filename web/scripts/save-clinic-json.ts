/**
 * scripts/save-clinic-json.ts — save clinics from pre-extracted JSON payloads,
 * WITHOUT any OpenAI calls. The extraction is done upstream (by Claude sub-agents
 * that scrape the sites); this script only writes through the existing tested
 * save layer: canonical treatment matching + junk filters + geocoding + external
 * rating + G99 linking + concern resolution.
 *
 *   bun scripts/save-clinic-json.ts <dir-or-file> [--dry]
 *
 * Payload shape (one JSON object per clinic):
 * {
 *   "website": "https://example.com/",
 *   "name": "Clinic Name", "tagline": "...", "about": "...",
 *   "phone": "...", "email": "...", "booking_url": "...",
 *   "socials": { "instagram":"", "facebook":"", "tiktok":"", "youtube":"", "x":"", "linkedin":"", "yelp":"" },
 *   "hours": { "MONDAY": {"open":"09:00","close":"17:00","is_open":true}, ... } | null,
 *   "locations": [ { "address":"", "city":"", "state":"", "zip":"", "phone":"" } ],
 *   "providers": [ { "name":"", "title":"", "image_url":"", "is_owner":false } ],
 *   "treatments": ["Botox","Dermal Fillers", ...],
 *   "concerns": ["Acne Scars","Wrinkles", ...],
 *   "images": { "logo":"", "cover":"", "gallery":[""], "before_after":[""] }
 * }
 */
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import pool, { query, queryOne } from "../src/lib/db";
import {
  saveClinicBundle, findClinicsByDomain, websiteDomain,
  type ClinicBundle, type SaveService,
} from "../src/lib/admin/clinic-save";
import { geocodeAddress } from "../src/lib/geocoder";
import { lookupG99ByDomain } from "../src/lib/g99/harvest";
import { resolveClinicRating } from "../src/lib/ratings/fetch-rating";
import { slugify } from "../src/lib/scraper/utils";
import { normalize, bestCatalogMatch, isServiceNoise, isConcernNoise } from "../src/lib/taxonomy/canonical";

interface Payload {
  website: string; name: string; tagline?: string; about?: string;
  phone?: string; email?: string; booking_url?: string;
  socials?: Record<string, string | null>;
  hours?: Record<string, unknown> | null;
  locations?: Array<{ address?: string; city?: string; state?: string; zip?: string; phone?: string }>;
  providers?: Array<{ name: string; title?: string; image_url?: string; is_owner?: boolean }>;
  treatments?: string[];
  concerns?: string[];
  images?: { logo?: string; cover?: string; gallery?: string[]; before_after?: string[] };
}

const NON_PHOTO =
  /(?:^|[/_-])(logos?|wordmark|brand|favicons?|icons?|badges?|social[-_]?shar\w*|og[-_]?images?|sharing|carecredit|patientfi|cherry|financing|banners?|categor|menu|text|placeholder|herospace|maps?|staticmaps?|mapbox|mock-?ups?|e-?books?)(?:[/_.-]|$)/i;
const isNonPhoto = (u: string | undefined) => !!u && NON_PHOTO.test((u.split("/").pop() || u));

async function saveOne(p: Payload): Promise<Record<string, unknown>> {
  const domain = websiteDomain(p.website);
  if (!domain) return { status: "failed", note: "no domain" };
  const existing = await findClinicsByDomain(domain);
  if (existing.length) return { domain, status: "skipped", note: "already in DB" };

  const g99 = await lookupG99ByDomain(domain).catch(() => null);

  // external rating (free website schema first, Google fallback)
  const loc0 = p.locations?.[0];
  const ratingQuery = [p.name, loc0?.city, loc0?.state].filter(Boolean).join(", ");
  const rating = await resolveClinicRating({ website: p.website, query: ratingQuery || null }).catch(() => null);

  // geocode each location (Nominatim ~1/s)
  const locations = [];
  for (const l of p.locations ?? []) {
    let lat: number | null = null, lng: number | null = null;
    // Full address first; fall back to street-without-suite, then city/state/zip,
    // then zip alone — Nominatim often 0-results on "Suite X" addresses.
    const street = (l.address ?? "").replace(/,?\s*(ste|suite|unit|#|bldg|building|apt|fl(oor)?)\.?\s*\S+.*$/i, "").trim();
    const attempts = [
      [l.address, l.city, l.state, l.zip].filter(Boolean).join(", "),
      [street, l.city, l.state, l.zip].filter(Boolean).join(", "),
      [l.city, l.state, l.zip].filter(Boolean).join(", "),
      [l.city, l.state].filter(Boolean).join(", "),
      l.zip ? `${l.zip}, USA` : "",
    ].filter((a, i, arr) => a && arr.indexOf(a) === i);
    for (const a of attempts) {
      const g = await geocodeAddress(a).catch(() => null);
      if (g) { lat = g.lat; lng = g.lng; break; }
    }
    locations.push({ address: l.address ?? null, city: l.city ?? null, state: l.state ?? null, zip: l.zip ?? null, phone: l.phone ?? null, lat, lng });
  }
  if (locations.length === 0) locations.push({});

  // treatments → SaveService[] (saveClinicServices applies isServiceNoise + canonical match)
  const services: SaveService[] = (p.treatments ?? [])
    .map((t) => (t ?? "").trim()).filter((t) => t && !isServiceNoise(t))
    .map((t) => ({ raw_name: t, general_name: t, public_decision: "public" as const }));

  // images — cover first (skip logos/maps/mockups), then gallery + before/after
  const gallery: Array<{ source_url: string }> = [];
  if (p.images?.cover && !isNonPhoto(p.images.cover)) gallery.push({ source_url: p.images.cover });
  for (const u of p.images?.gallery ?? []) if (u && !isNonPhoto(u)) gallery.push({ source_url: u });
  const images = {
    logo: p.images?.logo ? { source_url: p.images.logo } : null,
    gallery,
    before_after: (p.images?.before_after ?? []).filter(Boolean).map((u) => ({ source_url: u })),
  };

  const s = p.socials ?? {};
  const bundle: ClinicBundle = {
    website: p.website,
    business: { name: p.name || domain },
    clinic: {
      booking_url: p.booking_url ?? null, about: p.about ?? null, tagline: p.tagline ?? null,
      email: p.email ?? null, phone: p.phone ?? null, hours: p.hours ?? null,
      instagram_url: s.instagram ?? null, facebook_url: s.facebook ?? null, tiktok_url: s.tiktok ?? null,
      youtube_url: s.youtube ?? null, x_url: s.x ?? null, linkedin_url: s.linkedin ?? null, yelp_url: s.yelp ?? null,
    },
    locations,
    providers: (p.providers ?? []).filter((pr) => pr.name?.trim()).slice(0, 10).map((pr) => ({
      name: pr.name.trim(), title: pr.title ?? null, image_url: pr.image_url ?? null,
      card_tagline: pr.is_owner ? pr.title ?? null : null,
    })),
    services,
    images,
    reviews: [],
    ext_rating: rating?.rating ?? null,
    ext_review_count: rating?.reviewCount ?? null,
    ...(g99 ? { g99_clinic_id: g99.g99_clinic_id, g99_business_id: g99.g99_business_id, g99_tenant_id: g99.g99_tenant_id } : {}),
  };

  const saved = await saveClinicBundle(bundle, { overwrite: true });
  const clinicId = saved.clinics[0]?.id;

  // concerns — resolve/create then link (isConcernNoise backstop)
  let concernsSaved = 0;
  if (clinicId) {
    const catalog = await query<{ id: string; name: string; slug: string }>(`SELECT id, name, slug FROM concerns WHERE is_active = true`);
    const cat = catalog.map((c) => ({ id: c.id, name: c.name, slug: c.slug, aliases: [] as string[] }));
    const seen = new Set<string>();
    for (const raw of p.concerns ?? []) {
      const name = (raw ?? "").trim();
      if (!name || isConcernNoise(name)) continue;
      const n = normalize(name);
      let row = cat.find((c) => normalize(c.name) === n || normalize(c.slug) === n);
      if (!row) { const fz = bestCatalogMatch(name, cat, 0.84); if (fz) row = cat.find((c) => c.slug === fz.entry.slug); }
      if (!row) {
        const base = slugify(name) || "concern"; let sl = base, i = 2;
        while (await queryOne(`SELECT 1 FROM concerns WHERE slug = $1`, [sl])) sl = `${base}-${i++}`;
        const ins = await queryOne<{ id: string; name: string; slug: string }>(
          `INSERT INTO concerns (name, slug, origin, is_active) VALUES ($1,$2,'ai',true)
           ON CONFLICT (slug) DO UPDATE SET updated_at = now() RETURNING id, name, slug`, [name, sl]);
        row = { ...ins!, aliases: [] }; cat.push(row);
      }
      if (seen.has(row.id)) continue; seen.add(row.id);
      await query(
        `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active) VALUES ($1,$2,'scraped',true)
         ON CONFLICT (clinic_id, concern_id) DO UPDATE SET source='scraped', is_active=true, updated_at=now()
         WHERE clinic_concerns.source <> 'removed'`, [clinicId, row.id]);
      concernsSaved++;
    }
  }

  return {
    domain, status: "saved", slug: saved.clinics[0]?.slug, clinicId,
    locations: locations.length, geocoded: locations.filter((l) => l.lat != null).length,
    treatments: services.length, matched: saved.servicesMatched, auto: saved.servicesAuto,
    concernsSaved, providers: bundle.providers?.length ?? 0, images: saved.images,
    rating: rating ? `${rating.rating}★/${rating.reviewCount ?? "?"} (${rating.source})` : null,
    g99: g99 ? `${g99.g99_clinic_id}/${g99.g99_business_id}` : null,
  };
}

async function main() {
  const target = process.argv[2];
  const dry = process.argv.includes("--dry");
  if (!target) throw new Error("usage: bun scripts/save-clinic-json.ts <dir-or-file>");
  const files = statSync(target).isDirectory()
    ? readdirSync(target).filter((f) => f.endsWith(".json")).map((f) => join(target, f))
    : [target];
  console.log(`${files.length} payload file(s)${dry ? " (DRY)" : ""}\n`);

  const summary: Record<string, number> = { saved: 0, skipped: 0, failed: 0 };
  for (const f of files) {
    let p: Payload;
    try { p = JSON.parse(readFileSync(f, "utf8")); } catch (e) { console.log(`✗ ${f} — bad JSON`); summary.failed++; continue; }
    if (dry) { console.log(`· ${p.name} (${p.website}) — ${p.treatments?.length ?? 0} tx, ${p.concerns?.length ?? 0} concerns`); continue; }
    try {
      const r = await saveOne(p);
      summary[(r.status as string) ?? "failed"]++;
      console.log(`${r.status === "saved" ? "✓" : r.status === "skipped" ? "–" : "✗"} ${p.name} — ${JSON.stringify(r)}`);
    } catch (e) {
      summary.failed++;
      console.log(`✗ ${p.name} — ERROR: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!dry) {
    try { await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`); }
    catch { await query(`REFRESH MATERIALIZED VIEW clinic_search_view`); }
    console.log(`\n── Summary ──  saved=${summary.saved} skipped=${summary.skipped} failed=${summary.failed}  (view refreshed)`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
