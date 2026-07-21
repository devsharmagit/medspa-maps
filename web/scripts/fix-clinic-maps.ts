// @ts-nocheck

/**
 * scripts/fix-clinic-maps.ts — one-off DATA FIX for clinics already in the DB.
 *
 * Corrects each clinic location's Google Maps URL, street address, and
 * coordinates using the authoritative source:
 *   • Google Maps URL: the clinic site's OWN link (e.g. maps.app.goo.gl/…) when
 *     present — what the clinic actually published — else the Google Places link.
 *   • Address + coordinates: from the site link's /maps/place/…@lat,lng form when
 *     it carries them, otherwise from the Google Places API (searchText by
 *     name+address). goo.gl short links redirect via JS (no server-side coords),
 *     so their address/coords come from Places while the short link is still kept.
 *
 * Writes ONLY these columns on clinic_locations:
 *   google_maps_url, address, city, state, zip, lat, lng, geo, google_place_id
 * plus clinics.google_maps_url from the primary location. Nothing else is
 * touched (services, concerns, images, ratings, names all stay as-is).
 *
 *   bun scripts/fix-clinic-maps.ts                     # preview ALL (no writes)
 *   bun scripts/fix-clinic-maps.ts --clinic=<slug|id>  # scope to one clinic
 *   bun scripts/fix-clinic-maps.ts --limit=10          # first N clinics
 *   bun scripts/fix-clinic-maps.ts --apply             # write changes
 *
 * Idempotent and re-runnable. Preview is the default; add --apply to write.
 */
import "dotenv/config";
import * as cheerio from "cheerio";
import pool, { query, withTransaction } from "../src/lib/db";
import { fetchHtml, BROWSER_UA, parseAddress } from "../src/lib/scraper/utils";
import { collectMapsLinks, sanitizeMapsUrl, mapsUrlQuality } from "../src/lib/scraper/contact";

// ── args ────────────────────────────────────────────────────────────────────
const APPLY = process.argv.includes("--apply");
const clinicArg = process.argv.find((a) => a.startsWith("--clinic="))?.split("=")[1];
const limitArg = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 0;
const CONCURRENCY = 6;
const COORD_MISMATCH_KM = 25; // a Places result farther than this (with a zip that
                              // doesn't match) is treated as a different business.

// ── types ─────────────────────────────────────────────────────────────────--
interface Loc {
  id: string;
  label: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  is_primary: boolean;
  sort_order: number;
}
interface Place {
  url: string;            // link to STORE (site short link preferred)
  lat: number | null;
  lng: number | null;
  address: string | null; // street address parsed from the place
  placeId: string | null;
  tier: "site" | "places";
}

// ── geo helpers ───────────────────────────────────────────────────────────--
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const streetNo = (a?: string | null) => a?.match(/^\s*(\d+)/)?.[1] ?? null;

/** Parse address + lat/lng out of a resolved Google Maps URL (place/@/ll/q forms). */
function parseMapsUrl(href: string): { lat: number | null; lng: number | null; address: string | null } {
  let lat: number | null = null, lng: number | null = null, raw: string | null = null;
  try {
    const u = new URL(href.replace(/&amp;/gi, "&"));
    const place = u.pathname.match(/\/maps\/place\/([^/]+)\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (place) {
      raw = decodeURIComponent(place[1]).replace(/\+/g, " ").trim();
      lat = parseFloat(place[2]); lng = parseFloat(place[3]);
    }
    if (lat === null) {
      const at = u.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (at) { lat = parseFloat(at[1]); lng = parseFloat(at[2]); }
    }
    if (lat === null) {
      const ll = u.searchParams.get("ll");
      if (ll?.includes(",")) { const [a, b] = ll.split(","); lat = parseFloat(a); lng = parseFloat(b); }
    }
    if (!raw) {
      const q = u.searchParams.get("q") ?? u.searchParams.get("query");
      if (q && !/^-?\d+\.\d+,-?\d+\.\d+$/.test(q.trim())) raw = decodeURIComponent(q).replace(/\+/g, " ").trim();
    }
  } catch { /* not a URL */ }
  const suffix = /\b(Ave|Blvd|Ct|Cir|Dr|Hwy|Lane|Ln|Pkwy|Pl|Rd|Rte|St|Ste|Suite|Ter|Way|Fwy|Expy|Loop)\b/i;
  const address = raw && /^\d+\s/.test(raw) && suffix.test(raw)
    ? raw.replace(/\s+US(A)?\s*$/i, "").trim() : null;
  return {
    lat: lat !== null && !isNaN(lat) ? lat : null,
    lng: lng !== null && !isNaN(lng) ? lng : null,
    address,
  };
}

/** Follow a full (non-short) maps link's redirects to its canonical URL. goo.gl
 *  short links redirect client-side (JS), so they return unchanged here — the
 *  caller keeps the short link and fills coords/address from Places instead. */
async function resolveMapsHref(href: string): Promise<string> {
  if (!/goo\.gl\/maps/i.test(href) && !/maps\.app\.goo\.gl/i.test(href)) return href;
  try {
    const res = await fetch(href, {
      redirect: "follow",
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.url && /google\.[^/]+\/maps\/place/i.test(res.url)) return res.url;
  } catch { /* ignore — fall back to the short link */ }
  return href;
}

// ── Google Places (authoritative address/coords + fallback link) ────────────
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACE_API_KEY;
interface PlacesHit { id?: string; googleMapsUri?: string; formattedAddress?: string; location?: { latitude?: number; longitude?: number }; }
async function placesLookup(text: string): Promise<Place | null> {
  if (!PLACES_KEY) return null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": PLACES_KEY,
        "X-Goog-FieldMask": "places.id,places.googleMapsUri,places.location,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: PlacesHit[] };
    const p = data.places?.[0];
    if (!p?.googleMapsUri) return null;
    const addr = p.formattedAddress ?? null;
    const streetAddr = addr && /^\d+\s/.test(addr) ? addr.replace(/,?\s*USA\s*$/i, "").trim() : null;
    // Strip Google's `g_mp` tracking param → clean canonical `?cid=…` place link.
    let url = p.googleMapsUri;
    try { const u = new URL(url); const cid = u.searchParams.get("cid"); if (cid) url = `https://maps.google.com/?cid=${cid}`; } catch { /* keep as-is */ }
    return {
      url,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      address: streetAddr,
      placeId: p.id ?? null,
      tier: "places",
    };
  } catch { return null; }
}

// ── site link discovery ─────────────────────────────────────────────────---
const CONTACT_RE = /contact|location|find-us|visit|directions|our-office|hours/i;

/** Fetch homepage + a couple contact/location pages; return every maps link found. */
async function collectSiteMapsLinks(website: string): Promise<Array<{ href: string; text: string }>> {
  const origin = (() => { try { return new URL(website).origin; } catch { return null; } })();
  if (!origin) return [];
  const home = await fetchHtml(website);
  if (!home) return [];
  const $ = cheerio.load(home.html);
  const links = collectMapsLinks($);
  const extra: string[] = [];
  $("a[href]").each((_, el) => {
    if (extra.length >= 2) return;
    const raw = ($(el).attr("href") ?? "").trim();
    if (!raw) return;
    let abs: string; try { abs = new URL(raw, home.finalUrl).href; } catch { return; }
    if (new URL(abs).origin !== origin) return;
    if (CONTACT_RE.test(new URL(abs).pathname) && !extra.includes(abs)) extra.push(abs);
  });
  for (const url of extra) {
    const pg = await fetchHtml(url);
    if (pg) for (const l of collectMapsLinks(cheerio.load(pg.html))) links.push(l);
  }
  const seen = new Set<string>();
  const out: Array<{ href: string; text: string }> = [];
  for (const l of links) {
    const href = l.href.trim();
    if (!/^https?:/i.test(href) || seen.has(href)) continue;
    // Drop bare-coordinate search links (no real pin); keep short + place links.
    if (sanitizeMapsUrl(href) === null && !/goo\.gl/i.test(href)) continue;
    seen.add(href);
    out.push({ href, text: l.text });
  }
  out.sort((a, b) => mapsUrlQuality(b.href) - mapsUrlQuality(a.href));
  return out;
}

/** Resolve one raw site link into a Place (short-link → canonical → parse). */
async function siteLinkToPlace(href: string): Promise<Place> {
  const resolved = await resolveMapsHref(href);
  const { lat, lng, address } = parseMapsUrl(resolved);
  return { url: href, lat, lng, address, placeId: null, tier: "site" }; // keep the site's own link verbatim
}

/** Score how well a resolved place matches a location (multi-location clinics). */
function matchScore(p: Place, l: Loc): number {
  let s = 0;
  const pAddr = p.address ?? "";
  if (l.zip && pAddr.includes(l.zip)) s += 3;
  if (streetNo(pAddr) && streetNo(pAddr) === streetNo(l.address)) s += 2;
  if (l.city && new RegExp(`\\b${l.city.replace(/[^\w ]/g, "")}\\b`, "i").test(pAddr)) s += 1;
  if (p.lat != null && l.lat != null && l.lng != null && p.lng != null &&
      haversineKm(p.lat, p.lng, l.lat, l.lng) <= COORD_MISMATCH_KM) s += 2;
  return s;
}

/** A Places result is trusted unless it's demonstrably a different place
 *  (known to be far from the existing point AND its zip doesn't match). */
function placesTrusted(l: Loc, addr: string | null, lat: number | null, lng: number | null): boolean {
  const zipOk = !!(l.zip && addr && addr.includes(l.zip));
  if (lat != null && lng != null && l.lat != null && l.lng != null &&
      haversineKm(lat, lng, l.lat, l.lng) > COORD_MISMATCH_KM && !zipOk) return false;
  return true;
}

// ── planned change for one location ─────────────────────────────────────────
interface Change {
  loc: Loc;
  url: string | null;
  urlTier: "site" | "places" | null;
  coords: { lat: number; lng: number; tier: "site" | "places" } | null;
  address: { addr: string; tier: "site" | "places" } | null;
  placeId: string | null;
  setLink: boolean;
  note: string;
}

async function buildChange(
  clinicName: string,
  l: Loc,
  site: Place | null
): Promise<Change> {
  let url = site?.url ?? null;
  let urlTier: "site" | "places" | null = site ? "site" : null;
  let coords = site && site.lat != null && site.lng != null
    ? { lat: site.lat, lng: site.lng, tier: "site" as const } : null;
  let address = site?.address ? { addr: site.address, tier: "site" as const } : null;
  let placeId: string | null = null;

  // Fill any missing piece from Google Places (authoritative for address/coords).
  if (!url || !coords || !address) {
    const q = [clinicName, l.address, [l.city, l.state].filter(Boolean).join(" "), l.zip]
      .filter(Boolean).join(", ");
    const hit = await placesLookup(q);
    if (hit) {
      if (!url) { url = hit.url; urlTier = "places"; }
      if (!coords && hit.lat != null && hit.lng != null) coords = { lat: hit.lat, lng: hit.lng, tier: "places" };
      if (!address && hit.address) address = { addr: hit.address, tier: "places" };
      if (hit.placeId) placeId = hit.placeId;
    }
  }

  if (!url && !coords && !address)
    return { loc: l, url: null, urlTier: null, coords: null, address: null, placeId: null, setLink: false, note: "unresolved (no site link, no Places hit)" };

  // Trust gate applies only to Places-sourced data (a site link is the clinic's own).
  const placesData = urlTier === "places" || coords?.tier === "places" || address?.tier === "places";
  const trusted = !placesData || placesTrusted(l, address?.addr ?? null, coords?.lat ?? null, coords?.lng ?? null);

  if (!trusted) {
    // The Places top-result looks like a different business → keep existing data.
    // Only keep a link if it's the clinic's OWN site link.
    if (urlTier === "site" && url)
      return { loc: l, url, urlTier, coords: null, address: null, placeId: null, setLink: true,
        note: "link set; coords/addr kept (Places result looked like a different place)" };
    return { loc: l, url: null, urlTier: null, coords: null, address: null, placeId: null, setLink: false,
      note: "kept existing (Places result looked like a different place)" };
  }

  return { loc: l, url, urlTier, coords, address, placeId, setLink: !!url, note: "" };
}

async function writeChanges(clinicId: string, changes: Change[], primaryLink: string | null) {
  await withTransaction(async (client) => {
    for (const c of changes) {
      if (!c.setLink || !c.url) continue;
      const sets: string[] = ["google_maps_url = $2", "updated_at = now()"];
      const params: unknown[] = [c.loc.id, c.url];
      let n = 3;
      if (c.placeId) { sets.push(`google_place_id = $${n}`); params.push(c.placeId); n++; }
      if (c.coords) {
        // Separate placeholders for lat/lng (numeric columns) vs the geo point
        // (float8) — reusing one placeholder in both contexts trips Postgres'
        // "inconsistent types deduced for parameter" error.
        sets.push(`lat = $${n}`, `lng = $${n + 1}`,
          `geo = ST_SetSRID(ST_MakePoint($${n + 2}::float8, $${n + 3}::float8), 4326)::geography`);
        params.push(c.coords.lat, c.coords.lng, c.coords.lng, c.coords.lat); n += 4;
      }
      if (c.address) {
        const pa = parseAddress(c.address.addr);
        sets.push(`address = $${n}`); params.push(c.address.addr); n++;
        if (pa.city) { sets.push(`city = $${n}`); params.push(pa.city); n++; }
        if (pa.state) { sets.push(`state = $${n}`); params.push(pa.state); n++; }
        if (pa.zip) { sets.push(`zip = $${n}`); params.push(pa.zip); n++; }
      }
      await client.query(`UPDATE clinic_locations SET ${sets.join(", ")} WHERE id = $1`, params);
    }
    if (primaryLink)
      await client.query(`UPDATE clinics SET google_maps_url = $2, updated_at = now() WHERE id = $1`, [clinicId, primaryLink]);
  });
}

// ── per-clinic processing ─────────────────────────────────────────────────--
interface Stats { site: number; places: number; unresolved: number; addr: number; coords: number; kept: number; }
const stats: Stats = { site: 0, places: 0, unresolved: 0, addr: 0, coords: 0, kept: 0 };

async function processClinic(c: { id: string; name: string; slug: string; website: string | null }): Promise<void> {
  const locs = await query<Loc>(
    `SELECT id, label, address, city, state, zip, lat::float8, lng::float8, is_primary, sort_order
       FROM clinic_locations WHERE clinic_id = $1 AND is_active = true ORDER BY sort_order, created_at`,
    [c.id]
  );
  if (locs.length === 0) return;

  // Discover the site's own maps links and match them to locations.
  const siteLinks = c.website ? await collectSiteMapsLinks(c.website) : [];
  const sitePlaces: Place[] = [];
  for (const l of siteLinks.slice(0, 6)) sitePlaces.push(await siteLinkToPlace(l.href));

  const assigned = new Map<string, Place>();
  if (locs.length === 1) {
    if (sitePlaces[0]) assigned.set(locs[0].id, sitePlaces[0]);
  } else {
    const pairs: Array<{ s: number; loc: Loc; p: Place }> = [];
    for (const p of sitePlaces) for (const l of locs) pairs.push({ s: matchScore(p, l), loc: l, p });
    pairs.sort((a, b) => b.s - a.s);
    const usedPlace = new Set<Place>();
    for (const pr of pairs) {
      if (pr.s < 2) break;
      if (assigned.has(pr.loc.id) || usedPlace.has(pr.p)) continue;
      assigned.set(pr.loc.id, pr.p); usedPlace.add(pr.p);
    }
  }

  // Build the planned change for every location (Places fills the gaps).
  const changes: Change[] = [];
  for (const l of locs) changes.push(await buildChange(c.name, l, assigned.get(l.id) ?? null));

  // Tally + report.
  for (const ch of changes) {
    if (!ch.setLink && !ch.url) { ch.note.startsWith("kept") ? stats.kept++ : stats.unresolved++; continue; }
    ch.urlTier === "site" ? stats.site++ : stats.places++;
    if (ch.address) stats.addr++;
    if (ch.coords) stats.coords++;
    if (ch.note) stats.kept++;
  }
  const lines = changes.map((ch) => {
    const l = ch.loc;
    const tag = !ch.url ? "✗ unresolved" : `✓ ${ch.urlTier}`;
    const detail = ch.url
      ? `${ch.url.slice(0, 58)}${ch.address ? ` | addr→ ${ch.address.addr}` : ""}${ch.coords ? ` | ${ch.coords.lat.toFixed(4)},${ch.coords.lng.toFixed(4)}` : ""}${ch.note ? ` | ${ch.note}` : ""}`
      : ch.note;
    return `    [${tag}] ${l.label ?? l.city ?? l.id.slice(0, 8)} — ${detail}`;
  });
  console.log(`\n${c.name} (${c.slug}) — ${locs.length} loc`);
  console.log(lines.join("\n"));

  if (APPLY) {
    const primary = changes.find((ch) => ch.loc.is_primary && ch.setLink) ?? changes.find((ch) => ch.setLink);
    await writeChanges(c.id, changes, primary?.url ?? null);
  }
}

// ── concurrency pool ─────────────────────────────────────────────────────---
async function runPool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { await fn(items[idx]); } catch (e) { console.warn(`  ! error on item ${idx}: ${e instanceof Error ? e.message : e}`); }
    }
  }));
}

async function main() {
  let sql = `SELECT id, name, slug, website FROM clinics WHERE is_active = true`;
  const params: unknown[] = [];
  if (clinicArg) { sql += ` AND (slug = $1 OR id::text = $1)`; params.push(clinicArg); }
  sql += ` ORDER BY name`;
  if (limitArg) sql += ` LIMIT ${limitArg}`;
  const clinics = await query<{ id: string; name: string; slug: string; website: string | null }>(sql, params);

  console.log(`${APPLY ? "APPLY" : "PREVIEW"} — ${clinics.length} clinic(s)${PLACES_KEY ? "" : " (⚠ no Places API key — address/coords disabled)"}\n`);
  await runPool(clinics, CONCURRENCY, processClinic);

  console.log(`\n──────── summary ────────`);
  console.log(`links set via site link: ${stats.site}`);
  console.log(`links set via Places:    ${stats.places}`);
  console.log(`addresses corrected:     ${stats.addr}`);
  console.log(`coords corrected:        ${stats.coords}`);
  console.log(`kept/flagged for review: ${stats.kept}`);
  console.log(`unresolved:              ${stats.unresolved}`);
  if (!APPLY) console.log(`\n(preview only — re-run with --apply to write)`);

  if (APPLY) {
    try { await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`); }
    catch { try { await query(`REFRESH MATERIALIZED VIEW clinic_search_view`); } catch { /* view may not exist */ } }
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
