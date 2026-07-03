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

/** Render a markdown clinic list from real search rows. */
export function renderClinicList(search: SearchResult): string {
  return search.clinics
    .map((c) => {
      const loc = [c.city, c.state].filter(Boolean).join(", ") || "";
      const svc = c.treatments.slice(0, 3).join(", ");
      const parts = [
        `[${c.name}](${c.url})`,
        loc,
        ratingText(c.rating, c.reviews),
        svc ? `offers ${svc}` : "",
      ].filter(Boolean);
      return `- ${parts.join(" — ")}`;
    })
    .join("\n");
}

/**
 * Fully-templated answer built with ZERO model involvement — the demo-safety
 * floor used when the model times out, errors, or returns garbage.
 */
export function templatedAnswer(g: GatheredContext): string {
  const search = g.search;
  if (search && !search.unavailable && search.count > 0) {
    const where = search.filters.location ? ` near ${search.filters.location}` : "";
    const what = search.filters.treatment
      ? `${search.filters.treatment} clinics`
      : "clinics";
    return (
      `## ${capitalize(what)}${where}\n` +
      `${renderClinicList(search)}\n\n` +
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
    const price =
      t.price_from != null
        ? `- Typical cost: from $${t.price_from}/${t.price_unit ?? "unit"}\n`
        : "";
    const recovery = t.recovery_time ? `- Recovery: ${t.recovery_time}\n` : "";
    return (
      `## ${t.name}\n${t.summary}\n\n` +
      `- Typical time: ${t.treatment_time}\n` +
      price +
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
