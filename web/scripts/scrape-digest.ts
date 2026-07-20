/**
 * scripts/scrape-digest.ts — fetch a site with the hardened browser-UA fetcher
 * and print a COMPACT, extraction-ready digest (no LLM). Used to hand-build
 * clinic JSON payloads without sub-agents / OpenAI.
 *
 *   bun scripts/scrape-digest.ts <homepage-url> [extra-path ...]
 *
 * Fetches the homepage + auto-discovered key pages (services/about/team/contact/
 * conditions) + any extra paths, and for each prints: title, meta description,
 * phone/email hits, social + booking links, candidate hero/logo images, and
 * cleaned body text (capped). Absolute-izes all URLs.
 */
import "dotenv/config";
import * as cheerio from "cheerio";
import { fetchHtml, BROWSER_UA } from "../src/lib/scraper/utils";

const CAP = 3500; // chars of body text per page

function abs(base: string, u?: string | null): string | null {
  if (!u) return null;
  try { return new URL(u, base).href; } catch { return null; }
}

async function digest(url: string, label: string) {
  const r = await fetchHtml(url);
  if (!r) { console.log(`\n### ${label} (${url})\n[FETCH FAILED]`); return null; }
  const $ = cheerio.load(r.html);
  const base = r.finalUrl;
  const title = $("title").first().text().trim();
  const desc = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
  const ogImg = abs(base, $('meta[property="og:image"]').attr("content"));

  // links
  const links: Array<{ text: string; href: string }> = [];
  $("a[href]").each((_, el) => {
    const href = abs(base, $(el).attr("href")); if (!href) return;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    links.push({ text, href });
  });
  const social = links.filter((l) => /instagram\.com|facebook\.com|tiktok\.com|youtube\.com|linkedin\.com|yelp\.com|(^|\/\/)(x\.com|twitter\.com)/i.test(l.href));
  const booking = links.filter((l) => /book|appointment|schedule|consult|vagaro|square|acuity|calendly|janeapp|zenoti|mangomint|boulevard|setmore/i.test(l.href + " " + l.text)).slice(0, 6);
  const navish = links.filter((l) => /service|treatment|about|team|staff|provider|contact|condition|concern|location|menu|price/i.test(l.href) && l.text).slice(0, 40);

  // images: <img> src + all data-* + srcset (largest) + <source srcset> + CSS bg
  const imgs: string[] = [];
  const pushSrcset = (ss?: string | null) => {
    if (!ss) return;
    for (const part of ss.split(",")) { const u = part.trim().split(/\s+/)[0]; const a = abs(base, u); if (a) imgs.push(a); }
  };
  $("img, source").each((_, el) => {
    const $el = $(el);
    for (const a of ["src", "data-src", "data-lazy-src", "data-original", "data-bg"]) {
      const raw = $el.attr(a); if (raw && !raw.startsWith("data:")) { const s = abs(base, raw); if (s) imgs.push(s); }
    }
    pushSrcset($el.attr("srcset")); pushSrcset($el.attr("data-srcset"));
  });
  $("[style*='background']").each((_, el) => {
    const m = /background(?:-image)?\s*:\s*url\((['"]?)(.*?)\1\)/i.exec($(el).attr("style") || "");
    if (m && m[2] && !m[2].startsWith("data:")) { const s = abs(base, m[2]); if (s) imgs.push(s); }
  });
  const uniqImgs = [...new Set(imgs)]
    .filter((u) => !/\.svg($|\?)/i.test(u) && !/(logo|icon|favicon|sprite|placeholder|1x1|pixel|blank)/i.test(u))
    .filter((u) => /\.(jpe?g|png|webp|avif)($|\?)/i.test(u))
    .slice(0, 25);

  // phones/emails
  const bodyText = $("body").text();
  const phones = [...new Set((bodyText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []))].slice(0, 4);
  const emails = [...new Set((r.html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).filter((e) => !/\.(png|jpg|jpeg|webp|gif)$/i.test(e)))].slice(0, 4);

  // cleaned text: drop nav/header/footer/script/style
  const c = cheerio.load(r.html);
  c("nav, header, footer, script, style, noscript, form, svg").remove();
  const text = c("body").text().replace(/\s+/g, " ").trim().slice(0, CAP);

  console.log(`\n### ${label} (${base})`);
  console.log(`TITLE: ${title}`);
  if (desc) console.log(`DESC: ${desc.slice(0, 300)}`);
  if (ogImg) console.log(`OG_IMAGE: ${ogImg}`);
  if (phones.length) console.log(`PHONES: ${phones.join(" | ")}`);
  if (emails.length) console.log(`EMAILS: ${emails.join(" | ")}`);
  if (social.length) console.log(`SOCIAL: ${[...new Set(social.map((l) => l.href))].join(" | ")}`);
  if (booking.length) console.log(`BOOKING: ${[...new Set(booking.map((l) => l.href))].join(" | ")}`);
  console.log(`IMAGES:\n  ${uniqImgs.join("\n  ")}`);
  console.log(`TEXT: ${text}`);
  return { links: navish };
}

async function main() {
  const [home, ...extra] = process.argv.slice(2);
  if (!home) throw new Error("usage: bun scripts/scrape-digest.ts <homepage-url> [path ...]");
  const origin = new URL(home).origin;
  const d = await digest(home, "HOME");
  // pick key discovered pages
  const want = /service|treatment|about|team|staff|provider|contact|condition|concern|location|price|menu/i;
  const seen = new Set([new URL(home).pathname.replace(/\/$/, "")]);
  const picks: Array<{ text: string; href: string }> = [];
  for (const l of d?.links ?? []) {
    const p = new URL(l.href).pathname.replace(/\/$/, "");
    if (new URL(l.href).origin !== origin) continue;
    if (seen.has(p) || !want.test(p)) continue;
    seen.add(p); picks.push(l);
  }
  const extraUrls = extra.map((e) => (e.startsWith("http") ? e : origin + (e.startsWith("/") ? e : "/" + e)));
  const targets = [...extraUrls.map((u) => ({ text: "EXTRA", href: u })), ...picks].slice(0, 9);
  for (const t of targets) await digest(t.href, t.text.slice(0, 30) || "PAGE");
}
main().catch((e) => { console.error(e); process.exit(1); });
