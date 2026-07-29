/**
 * scripts/verify-clinic.ts — audit ONE saved clinic, end to end, with no AI.
 *
 *   bun --env-file=.env scripts/verify-clinic.ts <domain-or-slug> [more...]
 *
 * Prints everything that actually landed in the DB and independently re-checks
 * the parts a sub-agent could plausibly have got wrong:
 *
 *   images       — every URL re-fetched: HTTP status, content-type, real WxH.
 *                  Flags dead URLs, HTML-instead-of-image, a non-landscape cover,
 *                  a logo/badge sitting in cover or gallery, and any before_after
 *                  URL that collides with cover/gallery (a silent no-op insert).
 *   treatments   — raw_name → canonical service, plus anything isServiceNoise()
 *                  would reject and anything left unmapped (service_id NULL).
 *   concerns     — flags anything isConcernNoise() rejects, and freshly-created
 *                  origin='ai' rows (a new catalog row is the main way a bad
 *                  concern name becomes permanent).
 *   locations    — missing geo, state-format drift, city/state/zip gaps.
 *   basics       — required fields, plus the G99 placeholder emails that must
 *                  never be stored as a clinic's own email.
 *
 * Exit code is 0 always; read the FLAGS block. Nothing here writes to the DB.
 */
import "dotenv/config";
import pool, { query, queryOne } from "../src/lib/db";
import { probeImageDims } from "../src/lib/scraper/image-size";
import { isServiceNoise, isConcernNoise } from "../src/lib/taxonomy/canonical";
import { websiteDomain } from "../src/lib/admin/clinic-save";

/** G99 platform placeholder inboxes — never a real clinic contact address. */
const PLACEHOLDER_EMAILS = [/^seo\.loginuser@growth99\.com$/i, /^onboarding\.india@growth99\.com$/i];

const NON_PHOTO =
  /(?:^|[/_-])(logos?|wordmark|brand(?:ing)?|favicons?|icons?|badges?|seal|awards?|sponsors?|social[-_]?shar\w*|og[-_]?images?|sharing|carecredit|patientfi|cherry(?:payments)?|financing|banners?|cta|categor(?:y|ies)|menu|text|placeholder|herospace|maps?|staticmaps?|mapbox|streetview|mock-?ups?|e-?books?)(?:[/_.-]|$)/i;
const looksNonPhoto = (u: string) => NON_PHOTO.test(u.split("/").pop() || u);

interface Probe {
  status: number | string;
  contentType: string;
  dims: string;
  ratio: number | null;
}

async function probe(url: string): Promise<Probe> {
  let status: number | string = "ERR";
  let contentType = "-";
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
      headers: {
        Range: "bytes=0-2047",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    status = res.status;
    contentType = (res.headers.get("content-type") ?? "-").split(";")[0];
    await res.body?.cancel().catch(() => {});
  } catch (e) {
    status = e instanceof Error && /timeout|abort/i.test(e.message) ? "TIMEOUT" : "ERR";
  }
  const d = await probeImageDims(url);
  return {
    status,
    contentType,
    dims: d ? `${d.w}x${d.h}` : "?",
    ratio: d && d.h > 0 ? Number((d.w / d.h).toFixed(2)) : null,
  };
}

async function verifyOne(arg: string): Promise<void> {
  const domain = websiteDomain(arg);
  const clinic = await queryOne<{
    id: string; name: string; slug: string; website: string | null; booking_url: string | null;
    tagline: string | null; about: string | null; phone: string | null; email: string | null;
    hours: Record<string, unknown> | null; is_active: boolean;
    ext_rating: string | null; ext_review_count: number | null;
    instagram_url: string | null; facebook_url: string | null;
    g99_clinic_id: string | null; g99_business_id: string | null;
  }>(
    `SELECT id, name, slug, website, booking_url, tagline, about, phone, email, hours,
            is_active, ext_rating, ext_review_count, instagram_url, facebook_url,
            g99_clinic_id, g99_business_id
       FROM clinics
      WHERE slug = $1
         OR regexp_replace(regexp_replace(regexp_replace(lower(website),'^https?://',''),'^www\\.',''),'[/?#].*$','') = $2
      ORDER BY created_at LIMIT 1`,
    [arg, domain]
  );

  console.log(`\n${"═".repeat(78)}`);
  if (!clinic) {
    console.log(`✗ NOT FOUND — no clinic for "${arg}" (slug or website host)`);
    return;
  }
  const flags: string[] = [];
  console.log(`${clinic.name}   /clinics/${clinic.slug}`);
  console.log(`${"═".repeat(78)}`);
  console.log(`website     ${clinic.website}`);
  console.log(`active      ${clinic.is_active}`);
  console.log(`tagline     ${clinic.tagline ?? "— (none)"}`);
  console.log(`about       ${clinic.about ? `${clinic.about.slice(0, 150)}${clinic.about.length > 150 ? "…" : ""}` : "— (none)"}`);
  console.log(`phone       ${clinic.phone ?? "—"}`);
  console.log(`email       ${clinic.email ?? "—"}`);
  console.log(`booking     ${clinic.booking_url ?? "— (none)"}`);
  console.log(`rating      ${clinic.ext_rating ?? "—"}★ / ${clinic.ext_review_count ?? "—"} reviews`);
  console.log(`g99         clinic=${clinic.g99_clinic_id ?? "—"} business=${clinic.g99_business_id ?? "—"}`);
  // hours must be the canonical {DAY:{open,close,is_open}} map. A bare JSON
  // STRING ("Mon-Fri: 10-6") is stored by 129 existing clinics and renders as
  // nothing at all in WeeklyHours, so the shape is checked, not just presence.
  const DAYS7 = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const hoursVal = clinic.hours as unknown;
  let hoursDesc: string;
  if (hoursVal == null) {
    hoursDesc = "— (none)";
  } else if (typeof hoursVal === "string") {
    hoursDesc = `⚠ FREE-TEXT STRING (unrenderable): "${hoursVal.slice(0, 60)}"`;
    flags.push("hours is a JSON string, not the canonical {DAY:{open,close,is_open}} map — will not render");
  } else if (typeof hoursVal === "object" && !Array.isArray(hoursVal)) {
    const keys = Object.keys(hoursVal as Record<string, unknown>);
    const bad = keys.filter((k) => !DAYS7.includes(k));
    hoursDesc = `${keys.length} day key(s)${bad.length ? ` ⚠ non-day keys: ${bad.join(",")}` : ""}`;
    if (bad.length) flags.push(`hours has non-day keys: ${bad.join(", ")}`);
    if (keys.length < 5) flags.push(`hours covers only ${keys.length} day(s)`);
  } else {
    hoursDesc = `⚠ unexpected type: ${typeof hoursVal}`;
    flags.push(`hours has an unexpected JSON type (${typeof hoursVal})`);
  }
  console.log(`hours       ${hoursDesc}`);
  console.log(`socials     ig=${clinic.instagram_url ? "y" : "n"} fb=${clinic.facebook_url ? "y" : "n"}`);

  if (!clinic.tagline) flags.push("no tagline");
  if (!clinic.about) flags.push("no about text");
  if (!clinic.booking_url) flags.push("no booking_url");
  if (hoursVal == null) flags.push("no hours");
  if (clinic.email && PLACEHOLDER_EMAILS.some((re) => re.test(clinic.email!))) {
    flags.push(`email is a G99 PLACEHOLDER: ${clinic.email}`);
  }

  // ── locations ──────────────────────────────────────────────────────────────
  const locs = await query<{
    label: string | null; address: string | null; city: string | null; state: string | null;
    zip: string | null; lat: string | null; lng: string | null; google_maps_url: string | null;
  }>(
    `SELECT label, address, city, state, zip, lat, lng, google_maps_url
       FROM clinic_locations WHERE clinic_id = $1 ORDER BY sort_order`,
    [clinic.id]
  );
  console.log(`\n── locations (${locs.length}) ${"─".repeat(50)}`);
  for (const l of locs) {
    const geo = l.lat != null && l.lng != null ? `${Number(l.lat).toFixed(4)},${Number(l.lng).toFixed(4)}` : "NO GEO";
    console.log(`  • ${[l.address, l.city, l.state, l.zip].filter(Boolean).join(", ") || "(empty)"}`);
    console.log(`    geo=${geo}  maps=${l.google_maps_url ? "y" : "n"}`);
    if (l.lat == null) flags.push(`location "${l.city ?? l.address ?? "?"}" has no geo`);
    if (!l.city || !l.state) flags.push(`location "${l.address ?? "?"}" missing city/state`);
    if (l.state && l.state.length !== 2) flags.push(`state "${l.state}" is not a 2-letter abbrev`);
  }
  if (locs.length === 0) flags.push("NO locations at all");

  // ── providers ──────────────────────────────────────────────────────────────
  const provs = await query<{ name: string; title: string | null; image_url: string | null; card_tagline: string | null }>(
    `SELECT name, title, image_url, card_tagline FROM providers
      WHERE clinic_id = $1 AND is_active = true
      ORDER BY (card_tagline IS NOT NULL) DESC, name`,
    [clinic.id]
  );
  console.log(`\n── providers (${provs.length}) ${"─".repeat(50)}`);
  for (const p of provs) {
    console.log(`  • ${p.name}${p.title ? ` — ${p.title}` : ""}${p.card_tagline ? "  [OWNER]" : ""}  photo=${p.image_url ? "y" : "NO"}`);
  }

  // ── images (re-fetched) ────────────────────────────────────────────────────
  const imgs = await query<{ role: string; source_url: string; sort_order: number; alt_text: string | null }>(
    `SELECT role, source_url, sort_order, alt_text FROM images
      WHERE entity_type = 'clinic' AND entity_id = $1
      ORDER BY CASE role WHEN 'logo' THEN 0 WHEN 'cover' THEN 1 WHEN 'gallery' THEN 2 ELSE 3 END, sort_order`,
    [clinic.id]
  );
  console.log(`\n── images (${imgs.length}) — re-fetched live ${"─".repeat(30)}`);
  const probes = await Promise.all(imgs.map((i) => probe(i.source_url)));
  const byRole = new Map<string, string[]>();
  imgs.forEach((img, i) => {
    const pr = probes[i];
    byRole.set(img.role, [...(byRole.get(img.role) ?? []), img.source_url]);
    const bad = typeof pr.status === "number" ? pr.status >= 400 : true;
    const mark = bad ? "✗" : "✓";
    console.log(`  ${mark} [${img.role}] ${pr.status} ${pr.contentType} ${pr.dims}${pr.ratio ? ` r=${pr.ratio}` : ""}`);
    console.log(`      ${img.source_url}`);
    if (bad) flags.push(`${img.role} image is DEAD (${pr.status}): ${img.source_url}`);
    if (/^text\/html/i.test(pr.contentType)) flags.push(`${img.role} image serves HTML, not an image: ${img.source_url}`);
    if (img.role === "cover" && pr.ratio != null && pr.ratio < 1.2) {
      flags.push(`cover is not landscape (ratio ${pr.ratio}) — will letterbox in the hero: ${img.source_url}`);
    }
    if ((img.role === "cover" || img.role === "gallery") && looksNonPhoto(img.source_url)) {
      flags.push(`${img.role} looks like a logo/badge/graphic, not a photo: ${img.source_url}`);
    }
  });
  if (!byRole.has("cover")) flags.push("NO cover image (hero will show a placeholder)");
  if (!byRole.has("logo")) flags.push("no logo image");
  // before_after must be disjoint from cover+gallery — the images unique key is
  // (entity_type, entity_id, source_url) with NO role, so a shared URL means one
  // of the two inserts silently did nothing.
  const shown = new Set([...(byRole.get("cover") ?? []), ...(byRole.get("gallery") ?? [])]);
  for (const u of byRole.get("before_after") ?? []) {
    if (shown.has(u)) flags.push(`before_after URL collides with cover/gallery: ${u}`);
  }
  console.log(
    `  roles: logo=${(byRole.get("logo") ?? []).length} cover=${(byRole.get("cover") ?? []).length} ` +
      `gallery=${(byRole.get("gallery") ?? []).length} before_after=${(byRole.get("before_after") ?? []).length}`
  );

  // ── treatments ─────────────────────────────────────────────────────────────
  const svcs = await query<{ raw_name: string; canonical: string | null; slug: string | null; match_status: string | null; origin: string | null }>(
    `SELECT cs.raw_name, s.name AS canonical, s.slug, cs.match_status, s.origin
       FROM clinic_services cs
       LEFT JOIN services s ON s.id = cs.service_id
      WHERE cs.clinic_id = $1 AND cs.is_active = true
      ORDER BY s.name NULLS FIRST, cs.raw_name`,
    [clinic.id]
  );
  console.log(`\n── treatments (${svcs.length}) ${"─".repeat(50)}`);
  for (const s of svcs) {
    const noisy = isServiceNoise(s.raw_name) ? "  ⚠ isServiceNoise" : "";
    const arrow = s.canonical && s.canonical.toLowerCase() !== s.raw_name.toLowerCase() ? ` → ${s.canonical}` : "";
    console.log(`  • ${s.raw_name}${arrow}${s.origin === "ai" ? " (ai)" : ""}${s.canonical ? "" : "  ⚠ UNMAPPED"}${noisy}`);
    if (isServiceNoise(s.raw_name)) flags.push(`treatment is junk by isServiceNoise: "${s.raw_name}"`);
    if (!s.canonical) flags.push(`treatment unmapped (service_id NULL): "${s.raw_name}"`);
  }
  if (svcs.length === 0) flags.push("NO treatments — clinic will not surface in any treatment search");

  // ── concerns ───────────────────────────────────────────────────────────────
  const cons = await query<{ name: string; slug: string; origin: string | null; source: string; created_at: string }>(
    `SELECT c.name, c.slug, c.origin, cc.source, c.created_at::text
       FROM clinic_concerns cc JOIN concerns c ON c.id = cc.concern_id
      WHERE cc.clinic_id = $1 AND cc.is_active = true AND cc.source IN ('scraped','manual')
      ORDER BY c.name`,
    [clinic.id]
  );
  console.log(`\n── concerns (${cons.length}) ${"─".repeat(50)}`);
  for (const c of cons) {
    console.log(`  • ${c.name}${c.origin === "ai" ? " (ai-created)" : ""}  [${c.source}]`);
    if (isConcernNoise(c.name)) flags.push(`concern is junk by isConcernNoise: "${c.name}"`);
  }
  if (cons.length === 0) flags.push("NO concerns — clinic will not surface in any condition search");

  // ── search visibility ──────────────────────────────────────────────────────
  const inView = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM clinic_search_view WHERE clinic_id = $1`,
    [clinic.id]
  ).catch(() => null);
  console.log(`\nsearch view: ${inView?.n ? "present" : "ABSENT (run REFRESH MATERIALIZED VIEW clinic_search_view)"}`);
  if (!inView?.n) flags.push("not in clinic_search_view — will not appear in search");

  // ── flags ──────────────────────────────────────────────────────────────────
  console.log(`\n── FLAGS (${flags.length}) ${"─".repeat(52)}`);
  if (flags.length === 0) console.log("  none — everything checks out");
  else flags.forEach((f) => console.log(`  ⚠ ${f}`));
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (args.length === 0) {
    throw new Error("usage: bun --env-file=.env scripts/verify-clinic.ts <domain-or-slug> [more...]");
  }
  for (const a of args) await verifyOne(a);
  console.log();
  await pool.end();
}
main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
