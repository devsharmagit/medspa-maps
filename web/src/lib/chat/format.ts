/**
 * format.ts — parse the marker output contract and provide the fallback ladder.
 *
 * The model is asked to emit three literal marker lines: ANSWER / FOLLOWUPS /
 * MEMORY_UPDATE. Literal-marker splitting is a far easier target for a small
 * model than valid JSON or well-nested Markdown, and it's a trivial, robust
 * parse here. When the model doesn't comply we degrade gracefully — never
 * re-prompt (a second slow/rate-limited call is unacceptable mid-demo), and
 * never let a clinic list come from anything but backend-verified data.
 *
 * SERVER-SIDE ONLY.
 */
import type { SearchResult } from "@/lib/chat/data";
import type { GatheredContext } from "@/lib/chat/context";

export interface ParsedReply {
  answer: string;
  followups: string[];
  memory: string;
  /** true when the ANSWER marker was found (model followed the contract). */
  structured: boolean;
}

function cleanupBullets(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•\d.]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

/** Split a raw completion on the literal marker lines. */
export function parseReply(raw: string): ParsedReply {
  const text = (raw ?? "").trim();
  const reAnswer = /^\s*ANSWER\s*$/im;
  const reFollow = /^\s*FOLLOWUPS\s*$/im;
  const reMemory = /^\s*MEMORY_UPDATE\s*$/im;

  const aMatch = text.match(reAnswer);
  if (!aMatch) {
    // No markers — treat the whole thing as the answer (sanitized).
    return {
      answer: sanitizeStrayMarkers(text),
      followups: [],
      memory: "",
      structured: false,
    };
  }

  const fMatch = text.match(reFollow);
  const mMatch = text.match(reMemory);

  const aStart = (aMatch.index ?? 0) + aMatch[0].length;
  const fStart = fMatch ? fMatch.index ?? -1 : -1;
  const mStart = mMatch ? mMatch.index ?? -1 : -1;

  const answerEnd = Math.min(
    ...[fStart, mStart].filter((n) => n > aStart).concat([text.length])
  );
  const answer = text.slice(aStart, answerEnd).trim();

  let followups: string[] = [];
  if (fStart !== -1) {
    const fBodyEnd =
      mStart > fStart ? mStart : text.length;
    const fBodyStart = fStart + (fMatch ? fMatch[0].length : 0);
    followups = cleanupBullets(text.slice(fBodyStart, fBodyEnd));
  }

  let memory = "";
  if (mStart !== -1) {
    memory = text
      .slice(mStart + (mMatch ? mMatch[0].length : 0))
      .trim()
      .split("\n")[0]
      .trim();
  }

  return { answer, followups, memory, structured: true };
}

/** Strip stray literal marker words a fallback answer shouldn't show. */
function sanitizeStrayMarkers(s: string): string {
  return s
    .replace(/^\s*(ANSWER|FOLLOWUPS|MEMORY_UPDATE)\s*$/gim, "")
    .trim();
}

// ──────────────────────────────────────────────────────────────────────────
// Fallback answers built entirely from backend data (no model involvement)
// ──────────────────────────────────────────────────────────────────────────
/** Rating string, or "" when the clinic has no rating (caller omits it entirely). */
function ratingText(rating: number | null, reviews: number): string {
  if (rating == null || reviews === 0) return "";
  return `${rating.toFixed(1)}★ (${reviews} review${reviews === 1 ? "" : "s"})`;
}

/**
 * One-line summary of a result set, with NO practice names.
 *
 * This replaced a markdown list of every clinic. The cards below the answer are
 * the list; a prose copy duplicated them and made the model's typing, rather
 * than the search rows, look like the source of truth.
 */
export function describeResults(search: SearchResult & { total?: number }): string {
  const shown = search.clinics.length;
  const total = search.total ?? shown;
  const what = search.filters.treatment ? ` offering ${search.filters.treatment}` : "";
  const where = search.filters.location ? ` near ${search.filters.location}` : "";
  const more = total > shown ? ` of ${total} that match` : "";
  return `Showing ${shown} practice${shown === 1 ? "" : "s"}${more}${what}${where}.`;
}

/**
 * Fully-templated answer built with ZERO model involvement — the demo-safety
 * floor used when the model times out, errors, or returns garbage.
 */
export function templatedAnswer(g: GatheredContext): string {
  const search = g.search;
  if (search && !search.unavailable && search.count > 0) {
    return (
      `${describeResults(search)} Their details are on the cards below.\n\n` +
      `General information only — a licensed provider can confirm what's right for you. ` +
      `You can also [browse all results](${search.search_page}).`
    );
  }
  if (search && search.unavailable) {
    return `Clinic search is briefly unavailable right now. You can [browse clinics directly](${search.search_page}) in the meantime.`;
  }
  if (search && search.count === 0) {
    return `I couldn't find clinics matching that. Try broadening the location or a related treatment — or [browse the directory](${search.search_page}).`;
  }
  // Catalog fallback
  const t = (g.treatments ?? []).find((x) => x.found);
  if (t) {
    const recovery = t.recovery_time ? `- Recovery: ${t.recovery_time}\n` : "";
    return (
      `## ${t.name}\n${t.summary}\n\n` +
      `- Typical time: ${t.treatment_time}\n` +
      `- Results: ${t.results_timeline}, lasting ${t.results_duration}\n` +
      recovery +
      `\n[Read the full ${t.name} guide](${t.url}). General information only — a licensed provider can confirm what's right for you.`
    );
  }
  const c = (g.concerns ?? []).find((x) => x.found);
  if (c) {
    const recs = (c.recommended_treatments ?? [])
      .map((r) => `[${r.name}](${r.url})`)
      .join(", ");
    return (
      `## ${c.name}\n${c.overview ?? ""}\n\n` +
      (recs ? `Treatments we cover for this: ${recs}.\n\n` : "") +
      `General information only — a licensed provider can confirm what's right for you.`
    );
  }
  if (g.clinic) {
    const loc = [g.clinic.city, g.clinic.state].filter(Boolean).join(", ");
    const rt = ratingText(g.clinic.rating, g.clinic.reviews);
    const head = [loc, rt].filter(Boolean).join(" — ");
    return (
      `## ${g.clinic.name}\n` +
      (head ? `${head}.\n\n` : "") +
      (g.clinic.services.length
        ? `They list: ${g.clinic.services.slice(0, 8).join(", ")}.\n\n`
        : "") +
      `[View ${g.clinic.name}](${g.clinic.url}).`
    );
  }
  return "I can help you explore aesthetic treatments and find vetted medspas. Tell me a treatment and your city, and I'll pull up some options.";
}


// ──────────────────────────────────────────────────────────────────────────
// Pricing guard
// ──────────────────────────────────────────────────────────────────────────

/**
 * Any explicit money figure. Deliberately requires a currency marker ($, US$,
 * USD) or the words "dollars"/"bucks", so it can never eat the numbers the
 * assistant legitimately says — "4.8★ (120 reviews)", "20 practices",
 * "6.2 miles away", a ZIP, or a slug.
 */
const CURRENCY_RE =
  /(?:\$|US\$|USD\s?)\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*\s?(?:dollars|bucks)\b/i;

const PRICE_DEFLECTION =
  "Pricing varies quite a bit by provider, product and treatment plan, so I can't quote a figure — the practice can give you an exact price at a consultation. Want me to find some near you?";

/**
 * Strip any money figure the model produced, as a last line of defence behind
 * the prompt rule. We remove the WHOLE sentence, not just the number: deleting
 * the token alone leaves "Botox is typically  per unit," which reads as a bug
 * and still implies a price was known.
 */
export function stripPricing(answer: string): { text: string; stripped: number } {
  if (!CURRENCY_RE.test(answer)) return { text: answer, stripped: 0 };

  let stripped = 0;
  const kept = answer
    .split(/\n/)
    .map((line) => {
      const sentences = line.split(/(?<=[.!?])\s+/);
      const survivors = sentences.filter((s) => {
        if (CURRENCY_RE.test(s)) {
          stripped++;
          return false;
        }
        return true;
      });
      return survivors.join(" ");
    })
    .filter((line, i, all) => line.trim() !== "" || (i > 0 && all[i - 1].trim() !== ""))
    .join("\n")
    .trim();

  // If gutting the prices left nothing coherent, answer the question properly
  // instead of shipping a hollowed-out reply.
  if (!kept || stripped >= 2) return { text: PRICE_DEFLECTION, stripped };
  return { text: kept, stripped };
}

// ──────────────────────────────────────────────────────────────────────────
// Clinic grounding guard
// ──────────────────────────────────────────────────────────────────────────

const PRACTICE_LINK_RE = /\]\(\/practices\/([a-z0-9-]+)\)/gi;

/**
 * Every practice the answer links to must be one we actually retrieved.
 *
 * The prompt already forbids inventing clinics, but a small model handed no
 * SEARCH_RESULTS block will happily reproduce the names from its own few-shot
 * example. A fabricated practice — with a link that 404s — is worse than the
 * wrong-search bug this rewrite set out to fix, so it gets a deterministic
 * check rather than a prompt rule alone.
 *
 * Returns the ungrounded slugs; empty means the answer is safe to send.
 */
export function ungroundedPractices(answer: string, g: GatheredContext): string[] {
  const allowed = new Set<string>();
  for (const c of g.search?.clinics ?? []) allowed.add(c.slug);
  for (const c of g.search?.nearby?.clinics ?? []) allowed.add(c.slug);
  if (g.clinic?.slug) allowed.add(g.clinic.slug);

  const bad: string[] = [];
  for (const m of answer.matchAll(PRACTICE_LINK_RE)) {
    const slug = m[1].toLowerCase();
    if (!allowed.has(slug)) bad.push(slug);
  }
  return [...new Set(bad)];
}

/**
 * Force every site link back to a site-relative path.
 *
 * The prompt already demands relative links, but models reliably "helpfully"
 * prepend a domain they half-remember. That breaks two things: the widget
 * renders a non-"/" href as an external `_blank` anchor instead of a client-side
 * <Link>, and the grounding check below can no longer see the practice slug.
 */
export function normalizeSiteLinks(answer: string): string {
  return answer.replace(
    /\]\(\s*(?:https?:\/\/)(?:www\.)?(?:medspamaps?\.com|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?)(\/[^)\s]*)\)/gi,
    "]($1)",
  );
}

/**
 * On a turn that renders practice cards, delete every list item and heading
 * from the model's answer.
 *
 * The previous version only removed bullets containing a `](/practices/…)`
 * link, so when the model wrote the same list WITHOUT links it sailed through —
 * and when it did match, the "## Top matches" heading above the deleted list
 * was left dangling (the user saw a bare "##"). Since the model is no longer
 * given any practice data, it has nothing legitimate to list or head on these
 * turns, so removing both outright is both safe and total.
 */
export function stripLists(answer: string): string {
  const isListItem = (l: string) => /^\s*(?:[-*•]\s+|\d+[.)]\s+)/.test(l);
  const isHeading = (l: string) => /^\s*#{1,6}\s+/.test(l);

  const kept = answer
    .split("\n")
    .filter((l) => !isListItem(l) && !isHeading(l));

  return kept
    .join("\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


