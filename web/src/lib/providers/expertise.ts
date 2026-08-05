import pool from "@/lib/db";
import { extractViaTool, ingestModel, domainSeed } from "@/lib/ai/anthropic";
import { fetchHtml, load, getBase, toAbsolute } from "@/lib/scraper/utils";
import { discoverPages, pageGuesses } from "@/lib/scraper/pages";
import { extractProviders } from "@/lib/scraper/providers";

/** Row shape the expertise engine needs. Loaded by the API route and the
 *  pre-warm backfill script. */
export interface ProviderExpertiseRow {
  id: string;
  name: string;
  title: string | null;
  card_tagline: string | null;
  source_url: string | null;
  expertise_summary: string | null;
  website: string | null;
  clinic_slug: string;
}

export interface ResolveResult {
  summary: string;
  /** Served straight from the DB with no scrape/AI work. */
  cached: boolean;
  /** A real AI summary was produced (vs. the title-only fallback). */
  generated: boolean;
}

/** A found bio must be at least this long to be worth summarizing. */
const MIN_BIO_LEN = 160;
/** How many pages we're willing to actually fetch-OK beyond the homepage. */
const FETCH_BUDGET = 4;

/** Loose full-name match (first + last both present), punctuation/casing-insensitive. */
function nameMatches(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const pa = na.split(" ");
  const first = pa[0];
  const last = pa[pa.length - 1];
  return first.length > 1 && last.length > 1 && nb.includes(first) && nb.includes(last);
}

/** Strip serialized-markup noise (some CMSes, e.g. Elementor popups, store bio
 *  HTML as escaped text): tags, URLs, and `1429w` srcset width tokens. */
function cleanBioText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b\d+w\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fallback bio extractor for sites where `extractProviders` finds nothing —
 *  e.g. Elementor "popup" templates or card layouts where the bio sits in a
 *  container near a heading matching the provider's name. Returns the best
 *  (longest, but bounded) matching container's text, or "". */
function findBioByName($: ReturnType<typeof load>, name: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  const target = norm(name);
  const parts = target.split(" ");
  const first = parts[0];
  const last = parts[parts.length - 1];
  const matches = (h: string) =>
    !!h && (h === target || (first.length > 1 && last.length > 1 && h.includes(first) && h.includes(last)));

  let best = "";
  $("h1,h2,h3,h4").each((_, el) => {
    if (!matches(norm($(el).text()))) return;
    // Prefer an enclosing Elementor popup template (holds exactly one bio);
    // otherwise climb a few ancestors until the text looks bio-sized.
    const popup = $(el).closest('[data-elementor-type="popup"]');
    const containers = popup.length ? [popup] : [];
    if (!containers.length) {
      let n = $(el).parent();
      for (let d = 0; d < 6 && n.length; d++) {
        containers.push(n);
        n = n.parent();
      }
    }
    for (const c of containers) {
      const text = c.text().replace(/\s+/g, " ").trim();
      // Bounded: long enough to be a real bio, short enough to not be the page.
      if (text.length >= MIN_BIO_LEN && text.length <= 4000) {
        if (text.length > best.length) best = text;
        break;
      }
    }
  });
  return best;
}

/** Last-resort bio for a provider's OWN dedicated page (their `source_url`):
 *  collect the substantial paragraphs that mention them. A dedicated bio page
 *  often heads with a display name ("Dr. G") that won't match the DB name, so
 *  we match on the last name inside body paragraphs instead. Only used on the
 *  explicit source_url page, so it can't grab the wrong person off a team grid. */
function extractPageBioParagraphs($: ReturnType<typeof load>, name: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  const parts = norm(name).split(" ");
  const last = parts[parts.length - 1];
  if (last.length < 3) return "";

  const seen = new Set<string>();
  const out: string[] = [];
  $("p, .elementor-widget-text-editor").each((_, el) => {
    const t = $(el).clone().children("style,script").remove().end().text().replace(/\s+/g, " ").trim();
    if (t.length < 80 || t.length > 1500) return;
    if (!norm(t).includes(last)) return;
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
  });
  return cleanBioText(out.join(" ")).slice(0, 3500).trim();
}

/** Find same-domain links that point to THIS provider's own bio page — a common
 *  pattern where a team grid links each card to `/first-last/`. Matches the
 *  anchor's own text or a heading inside it against the provider name. */
function findProviderLinks($: ReturnType<typeof load>, baseUrl: string, name: string): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  const target = norm(name);
  const parts = target.split(" ");
  const first = parts[0];
  const last = parts[parts.length - 1];
  const matches = (h: string) =>
    !!h && (h === target || (first.length > 1 && last.length > 1 && h.includes(first) && h.includes(last)));

  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    let ok = matches(norm($(el).text()));
    if (!ok) {
      const h = $(el).find("h1,h2,h3,h4,h5").first();
      if (h.length && matches(norm(h.text()))) ok = true;
    }
    if (!ok) return;
    const abs = toAbsolute(href, baseUrl);
    if (!abs) return;
    try {
      if (new URL(abs).hostname === new URL(baseUrl).hostname) out.add(abs);
    } catch {
      /* skip unparseable */
    }
  });
  return [...out];
}

/** Non-AI fallback so the modal always shows something. */
function fallbackSummary(p: ProviderExpertiseRow): string {
  return (
    p.card_tagline?.trim() ||
    (p.title ? `${p.name} — ${p.title}.` : `${p.name} is part of the care team at this practice.`)
  );
}

/** Locate the provider's bio across the clinic site. Discovers the real
 *  team/about page from the homepage nav (blind URL guesses miss non-standard
 *  paths like `/about/team`), then falls back to guesses. Budget counts only
 *  successful fetches so 404 guesses don't burn it. */
async function findProviderBio(
  provider: ProviderExpertiseRow
): Promise<{ bioText: string; matchedPageUrl: string | null }> {
  let bioText = "";
  let matchedPageUrl: string | null = null;

  const consider = ($: ReturnType<typeof load>, finalUrl: string) => {
    const scraped = extractProviders($, getBase(finalUrl));
    const match = scraped.find((s) => nameMatches(provider.name, s.name));
    if (match && (match.bio || match.specializations?.length)) {
      const t = cleanBioText(
        [match.bio, (match.specializations ?? []).join(", ")].filter(Boolean).join("\n")
      );
      if (t.length > bioText.length) {
        bioText = t;
        matchedPageUrl = finalUrl;
      }
    }
    const pageBio = cleanBioText(findBioByName($, provider.name));
    if (pageBio.length > bioText.length) {
      bioText = pageBio;
      matchedPageUrl = finalUrl;
    }
  };

  const seen = new Set<string>();
  let okFetches = 0;

  // Visit a page: try structured + card/popup extraction; on the provider's own
  // dedicated page, fall back to name-mentioning paragraphs; then follow a
  // per-provider bio link (e.g. team grid → /first-last/) if we still have nothing.
  const visit = async (url: string, isOwnPage: boolean): Promise<void> => {
    if (!url || seen.has(url) || bioText.length >= MIN_BIO_LEN || okFetches >= FETCH_BUDGET) return;
    seen.add(url);
    const fetched = await fetchHtml(url);
    if (!fetched) return; // 404 / unreachable — doesn't consume the budget
    okFetches++;
    const $ = load(fetched.html);
    consider($, fetched.finalUrl);
    if (bioText.length < MIN_BIO_LEN && (isOwnPage || url === provider.source_url)) {
      const para = extractPageBioParagraphs($, provider.name);
      if (para.length > bioText.length) {
        bioText = para;
        matchedPageUrl = fetched.finalUrl;
      }
    }
    if (bioText.length >= MIN_BIO_LEN) return;
    // Follow a link that points to this provider's own bio page.
    for (const link of findProviderLinks($, getBase(fetched.finalUrl), provider.name)) {
      await visit(link, true);
      if (bioText.length >= MIN_BIO_LEN) return;
    }
  };

  try {
    if (provider.source_url) await visit(provider.source_url, true);

    if (bioText.length < MIN_BIO_LEN && provider.website) {
      // Homepage: founders often appear there, and its nav tells us where the
      // real team/about page lives.
      const home = await fetchHtml(provider.website);
      const guesses = pageGuesses(provider.website, "team");
      if (home) {
        seen.add(provider.website);
        okFetches++;
        const $h = load(home.html);
        consider($h, home.finalUrl);
        if (bioText.length < MIN_BIO_LEN) {
          for (const link of findProviderLinks($h, getBase(home.finalUrl), provider.name)) {
            await visit(link, true);
            if (bioText.length >= MIN_BIO_LEN) break;
          }
        }
        if (bioText.length < MIN_BIO_LEN) {
          const disc = discoverPages($h, getBase(home.finalUrl));
          if (disc.team) await visit(disc.team, false);
          if (disc.about) await visit(disc.about, false);
        }
      }
      for (const url of guesses) {
        if (bioText.length >= MIN_BIO_LEN) break;
        await visit(url, false);
      }
    }
  } catch {
    /* scrape failure — caller degrades to the fallback summary */
  }

  return { bioText, matchedPageUrl };
}

async function summarize(provider: ProviderExpertiseRow, bioText: string): Promise<string> {
  const result = await extractViaTool<{ summary: string }>({
    system:
      "You write a factual 3–5 sentence summary of an aesthetic-medicine provider's background, expertise, and focus areas, to help a patient decide. Cover their credentials/training, notable experience, and the treatments or areas they specialize in — but use ONLY the supplied information; never invent credentials, numbers, years, or claims. Neutral, non-promotional tone. This is not medical advice.",
    user: `Provider: ${provider.name}\nTitle/credentials: ${provider.title ?? "n/a"}\nSource bio / focus areas:\n${bioText}`,
    toolName: "provider_expertise",
    toolDescription: "Return a short expertise summary for this provider.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["summary"],
      properties: {
        summary: { type: "string", description: "3–5 sentence expertise summary, patient-facing." },
      },
    },
    model: ingestModel(),
    maxTokens: 500,
    seed: domainSeed(`${provider.clinic_slug}:${provider.name}`),
  });
  return result.data.summary?.trim() ?? "";
}

async function cacheSummary(id: string, summary: string, sourceUrl: string | null): Promise<void> {
  await pool.query(
    `UPDATE providers
        SET expertise_summary = $2,
            source_url = COALESCE($3, source_url),
            summary_updated_at = NOW()
      WHERE id = $1`,
    [id, summary, sourceUrl]
  );
}

/**
 * Resolve a provider's expertise summary: return the cached row value, or scrape
 * the clinic site → AI-summarize → cache. Never throws for scrape/AI failures.
 *
 * Caching policy:
 *  - real AI summary → cached (with the source page).
 *  - no scrapable bio (bio-less staff) → the title fallback is cached too, so
 *    repeat clicks are instant. A `force` re-run can upgrade it later.
 *  - bio found but AI failed (transient/misconfig) → fallback returned, NOT
 *    cached, so a later attempt can still produce a real summary.
 */
export async function resolveProviderExpertise(
  provider: ProviderExpertiseRow,
  opts: { force?: boolean } = {}
): Promise<ResolveResult> {
  const force = opts.force ?? false;

  if (!force && provider.expertise_summary && provider.expertise_summary.trim()) {
    return { summary: provider.expertise_summary.trim(), cached: true, generated: true };
  }

  const { bioText, matchedPageUrl } = await findProviderBio(provider);

  if (!bioText.trim()) {
    const summary = fallbackSummary(provider);
    await cacheSummary(provider.id, summary, null);
    return { summary, cached: false, generated: false };
  }

  let summary: string;
  try {
    summary = await summarize(provider, bioText);
  } catch {
    // Transient/config AI failure — show fallback but don't cache it.
    return { summary: fallbackSummary(provider), cached: false, generated: false };
  }

  if (!summary) {
    return { summary: fallbackSummary(provider), cached: false, generated: false };
  }

  await cacheSummary(provider.id, summary, matchedPageUrl);
  return { summary, cached: false, generated: true };
}
