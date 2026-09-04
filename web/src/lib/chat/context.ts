/**
 * context.ts — assembles the single labeled user message injected into the LLM.
 *
 * Everything is fixed-shape, plainly-labeled TEXT (never raw JSON/DOM) — a
 * small model parses prose-with-structure far more reliably than nested JSON.
 * Each block has a hard character cap (~4 chars/token, no tokenizer call), and
 * blocks that were *attempted but empty* get an explicit marker (NONE_FOUND /
 * SEARCH_UNAVAILABLE) rather than silent omission — a silently-missing section
 * is exactly what makes a small model invent clinics to fill the gap.
 *
 * SERVER-SIDE ONLY.
 */
import { CANONICAL_SERVICES, CANONICAL_CONCERNS } from "@/lib/taxonomy/canonical";
import type {
  ClinicContext,
  TreatmentInfo,
  ConcernInfo,
} from "@/lib/chat/data";
import type { ChatSearchResult } from "@/lib/chat/search-adapter";
import type { LiveCatalog } from "@/lib/chat/catalog";
import { DEFAULT_ORIGIN_RADIUS_MILES } from "@/lib/search/location-scope";
import type { PageContext, Slots } from "@/lib/chat/intent";

export interface TurnMsg {
  role: "user" | "assistant";
  content: string;
}

export interface GatheredContext {
  page: PageContext;
  clinic?: ClinicContext | null;
  search?: ChatSearchResult | null;
  treatments?: TreatmentInfo[];
  concerns?: ConcernInfo[];
}

export interface MemoryInput {
  summary?: string;
  slots: Slots;
  /** recent raw turns EXCLUDING the current question (already trimmed) */
  recentTurns: TurnMsg[];
  /** live catalog, for the taxonomy sample + true totals */
  catalog?: LiveCatalog | null;
}

// Per-block character caps (~4 chars/token).
const CAP = {
  pageContext: 600,
  clinic: 1600,
  searchResults: 1800,
  catalog: 1100,
  slots: 300,
  summary: 900,
  recentTurns: 2200,
} as const;

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

/** Rating string, or "" when the clinic has no rating (caller omits it entirely). */
function ratingText(rating: number | null, reviews: number): string {
  if (rating == null || reviews === 0) return "";
  return `${rating.toFixed(1)}★ (${reviews} review${reviews === 1 ? "" : "s"})`;
}

// ──────────────────────────────────────────────────────────────────────────
// Individual blocks
// ──────────────────────────────────────────────────────────────────────────
/**
 * A SAMPLE of the catalog, not the catalog.
 *
 * This used to list the 15 curated treatments and 17 curated concerns, which
 * the model quite reasonably read as a whitelist — so it told people that real,
 * offered treatments "aren't covered". The live catalog has ~966 services and
 * ~191 concerns; dumping all of them would be tens of KB and would still read
 * as a whitelist. So we give the most-offered ones (with counts that match the
 * search dropdown exactly) and state plainly that the list is not the boundary.
 */
function taxonomyBlock(catalog: LiveCatalog | null | undefined): string {
  if (!catalog || (!catalog.topTreatments.length && !catalog.topConcerns.length)) {
    const t = CANONICAL_SERVICES.map((s) => `${s.name} (/search?q=${s.slug})`).join("; ");
    const c = CANONICAL_CONCERNS.map((x) => `${x.name} (/search?condition=${x.slug})`).join("; ");
    return `SITE_TAXONOMY (a sample — the full catalog is larger):\nTreatments — ${t}\nConcerns — ${c}`;
  }

  const t = catalog.topTreatments
    .map((s) => `${s.name} — ${s.count} practices (/search?q=${s.slug})`)
    .join("; ");
  const c = catalog.topConcerns
    .map((x) => `${x.name} — ${x.count} practices (/search?condition=${x.slug})`)
    .join("; ");

  return (
    `SITE_TAXONOMY:\n` +
    `This site covers ${catalog.serviceCount} treatments and ${catalog.concernCount} conditions — ` +
    `far more than can be listed here. The ones below are simply the most widely offered. ` +
    `NEVER tell someone a treatment or condition isn't covered just because it is absent from this list; ` +
    `anything the user named has already been resolved for you and appears in RESOLVED_ENTITIES.\n` +
    `Most-offered treatments — ${t}\n` +
    `Most-common conditions — ${c}\n` +
    `Browse everything: /search`
  );
}

/**
 * What the backend actually resolved this turn. This is the block that stops
 * the "we don't offer Botox in Salt Lake City" failure: the model is told the
 * treatment and the place both resolved BEFORE it ever sees a result count, so
 * an empty result set reads as "none nearby", never as "we don't do that".
 */
function resolvedEntitiesBlock(search: ChatSearchResult | null | undefined): string | null {
  if (!search) return null;
  const lines: string[] = [];

  if (search.resolved) {
    const path =
      search.resolved.kind === "treatment"
        ? `/search?q=${search.resolved.slug}`
        : `/search?condition=${search.resolved.slug}`;
    lines.push(`${search.resolved.kind} = ${search.resolved.name} (${path}) — this IS offered on this site`);
    // Curated aliases deliberately widen a search (Dysport → Botox,
    // Morpheus8 → Microneedling) to surface more practices. Say so plainly;
    // otherwise the model sees the mismatch and tells the user we can't find
    // the thing they asked for, while listing clinics right underneath.
    const asked = (search.queryText ?? "").trim();
    if (asked && asked.toLowerCase() !== search.resolved.name.toLowerCase()) {
      lines.push(
        `The user asked for "${asked}". On this site that is grouped under ${search.resolved.name}, ` +
          `so the practices below are the right answer. Acknowledge "${asked}" in your reply and ` +
          `mention it is listed under ${search.resolved.name} — do NOT say you couldn't find it.`,
      );
    }
  } else if (search.filters.treatment) {
    lines.push(`UNRESOLVED: "${search.filters.treatment}" — we could not match this to the catalog`);
  }

  const loc = search.location;
  if (loc?.label) {
    lines.push(
      loc.lat != null
        ? `location = ${loc.label} (searched within ${DEFAULT_ORIGIN_RADIUS_MILES} miles)`
        : `location = ${loc.label}`,
    );
  }

  return lines.length ? `RESOLVED_ENTITIES:\n${lines.join("\n")}` : null;
}

/**
 * Static list of site tools the assistant can hand the user off to. The model
 * has no way to know these exist otherwise, so without this block it tells
 * people "I can't look at photos" and the conversation dead-ends — when the
 * site has a photo-based treatment finder built exactly for that.
 */
function siteFeaturesBlock(): string {
  return (
    `SITE_FEATURES (real pages on this site — offer them when relevant, link exactly as written):\n` +
    `- Find My Treatment (/ai-aesthetic-treatment-finder): a guided treatment finder. ` +
    `The user answers a few questions (age range required; skin goals/concerns; optional city or ZIP) ` +
    `and can OPTIONALLY upload up to 8 photos (JPEG/PNG/WebP, max 5 MB each). ` +
    `It returns suggested treatments for their profile plus nearby clinics. ` +
    `This is the right place to send anyone who wants to share a photo, or who asks ` +
    `"which treatment is right for me" — you cannot view photos yourself in this chat.\n` +
    `- Clinic search (/search): browse and filter vetted clinics by treatment and location.`
  );
}

function pageContextBlock(g: GatheredContext): string {
  const { page } = g;
  let body: string;
  switch (page.type) {
    case "home":
      body = "Home page. No specific treatment, concern, or clinic in focus.";
      break;
    case "search":
      body = "Search results page. The user is browsing clinics.";
      break;
    case "treatment": {
      const svc = CANONICAL_SERVICES.find((s) => s.slug === page.slug);
      body = svc
        ? `Treatment guide page for "${svc.name}" (/search?q=${svc.slug}).`
        : "A treatment guide page.";
      break;
    }
    case "concern": {
      const cn = CANONICAL_CONCERNS.find((c) => c.slug === page.slug);
      body = cn
        ? `Concern guide page for "${cn.name}" (/search?condition=${cn.slug}).`
        : "A concern guide page.";
      break;
    }
    case "clinic":
    case "provider":
      body = g.clinic
        ? `Viewing the page for "${g.clinic.name}". Details in CLINIC_IN_FOCUS.`
        : "A clinic/provider page.";
      break;
    default:
      body = "A general page on the site.";
  }
  return clip(`PAGE_CONTEXT:\n${body}`, CAP.pageContext);
}

function clinicBlock(clinic: ClinicContext | null | undefined): string | null {
  if (!clinic) return null;
  const services = clinic.services.length
    ? clinic.services.join(", ")
    : "no services listed";
  const rt = ratingText(clinic.rating, clinic.reviews);
  const where =
    [clinic.address, clinic.city, clinic.state].filter(Boolean).join(", ") ||
    "location not listed";

  const lines = [
    `CLINIC_IN_FOCUS — everything below is from our database; state it freely.`,
    `Name: ${clinic.name} (${clinic.url})`,
    clinic.tagline ? `Tagline: ${clinic.tagline}` : "",
    `Address: ${where}`,
    clinic.locationCount > 1 ? `Locations: ${clinic.locationCount} in total` : "",
    rt ? `Rating: ${rt}` : "",
    clinic.phone ? `Phone: ${clinic.phone}` : "",
    clinic.website ? `Website: ${clinic.website}` : "",
    clinic.hours ? `Hours: ${clinic.hours}` : "Hours: not listed — suggest calling or checking their page",
    `Booking: ${clinic.hasBooking ? "online booking is available on their page" : "no online booking listed"}`,
    `Services offered (the ONLY services this practice offers — if a treatment is not in this list, it does not list it): ${services}`,
    clinic.about ? `About: ${clinic.about}` : "",
  ].filter(Boolean);

  return clip(lines.join("\n"), CAP.clinic);
}

function searchBlock(search: ChatSearchResult | null | undefined): string | null {
  if (!search) return null;

  if (search.unavailable) {
    return `SEARCH_RESULTS: SEARCH_UNAVAILABLE\nPractice search could not run this time. Tell the user search is briefly unavailable and point them to ${search.search_page}.`;
  }

  const what = search.resolved?.name ?? null;
  const where = search.location?.label ?? null;
  const scope = [what ? `for ${what}` : null, where ? `near ${where}` : null]
    .filter(Boolean)
    .join(" ");

  // Nothing in the area, but the engine found some farther out.
  if (search.count === 0 && search.nearby && search.nearby.total > 0) {
    const dist =
      search.nearby.nearestMiles != null
        ? ` The nearest is about ${Math.round(search.nearby.nearestMiles)} miles away.`
        : "";
    return clip(
      `SEARCH_RESULTS: NONE_IN_AREA — ${search.nearby.clinics.length} practice(s) shown as cards below your answer.\n` +
        `None were inside the searched radius ${scope || "there"}, but ${search.nearby.total} offer this elsewhere.${dist}\n` +
        `Say this is a distance problem, NOT that the treatment is unavailable.\n` +
        `${NAMELESS_RULE}\nFull results: ${search.nearby.search_page}`,
      CAP.searchResults,
    );
  }

  if (search.count === 0) {
    return `SEARCH_RESULTS: NONE_FOUND\nNo practices matched these filters. Do NOT name any practice, and do NOT say the treatment isn't offered — say none matched this location and suggest widening the area. Browse page: ${search.search_page}.`;
  }

  const more = search.total > search.count ? ` out of ${search.total} that match` : "";
  return clip(
    `SEARCH_RESULTS: ${search.count} practice(s)${more} are shown as cards directly below your answer${scope ? `, ${scope}` : ""}.\n` +
      `${NAMELESS_RULE}\nFull results: ${search.search_page}`,
    CAP.searchResults,
  );
}

/** The one rule that makes the cards, not the model, the source of truth. */
const NAMELESS_RULE =
  "You have NOT been given the practices' names, ratings, locations or services, and you must never guess them — the cards already show all of that. " +
  "Write one or two sentences of orientation plus one suggestion. Do NOT write a list, a table, or a heading: the cards are the list.";

/**
 * Superlatives computed by US from the retrieved rows, for follow-ups like
 * "which of those has the best reviews?". The model quotes a fact we worked
 * out; it never ranks anything or recalls a name on its own. This is the only
 * place a practice name reaches the prompt on a search turn.
 */
function resultFactsBlock(search: ChatSearchResult | null | undefined): string | null {
  if (!search || search.unavailable) return null;
  const clinics = search.clinics.length ? search.clinics : (search.nearby?.clinics ?? []);
  if (clinics.length < 1) return null;

  const facts: string[] = [];

  const rated = clinics.filter((c) => c.rating != null);
  if (rated.length) {
    const best = rated.reduce((a, b) =>
      (b.rating ?? 0) !== (a.rating ?? 0)
        ? (b.rating ?? 0) > (a.rating ?? 0)
          ? b
          : a
        : b.reviews > a.reviews
          ? b
          : a,
    );
    facts.push(
      `highest rated: ${best.name} — ${best.rating?.toFixed(1)}★${best.reviews ? ` from ${best.reviews} reviews` : ""}`,
    );

    const mostReviewed = rated.reduce((a, b) => (b.reviews > a.reviews ? b : a));
    if (mostReviewed.slug !== best.slug) {
      facts.push(`most reviewed: ${mostReviewed.name} — ${mostReviewed.reviews} reviews`);
    }
  }

  const measured = clinics.filter((c) => c.distance_miles != null);
  if (measured.length) {
    const nearest = measured.reduce((a, b) =>
      (b.distance_miles ?? 0) < (a.distance_miles ?? 0) ? b : a,
    );
    facts.push(
      `closest: ${nearest.name} — about ${Math.round(nearest.distance_miles ?? 0)} miles away`,
    );
  }

  if (!facts.length) return null;
  return clip(
    `RESULT_FACTS (computed from the cards; quote these verbatim if asked to compare, and name no other practice):\n` +
      facts.map((f) => `- ${f}`).join("\n"),
    CAP.slots,
  );
}

function catalogBlock(
  treatments: TreatmentInfo[] | undefined,
  concerns: ConcernInfo[] | undefined
): string | null {
  const parts: string[] = [];
  for (const t of treatments ?? []) {
    if (!t.found) continue;
    const treats = (t.treats_concerns ?? [])
      .map((c) => c.name)
      .slice(0, 4)
      .join(", ");
    parts.push(
      `TREATMENT ${t.name} (${t.url}): ${t.summary} ` +
        `Category: ${t.category}. Time: ${t.treatment_time}. ` +
        `Results show: ${t.results_timeline}, last ${t.results_duration}. Recovery: ${t.recovery_time ?? "minimal"}. ` +
        (treats ? `Helps with: ${treats}.` : "")
    );
  }
  for (const c of concerns ?? []) {
    if (!c.found) continue;
    const recs = (c.recommended_treatments ?? [])
      .map((r) => `${r.name} (${r.url})`)
      .join(", ");
    parts.push(
      `CONCERN ${c.name} (${c.url}): ${c.overview ?? ""} ` +
        (recs ? `Treatments we cover for this: ${recs}.` : "")
    );
  }
  if (!parts.length) return null;
  return clip(`CATALOG_FACTS:\n${parts.join("\n")}`, CAP.catalog);
}

function slotsBlock(slots: Slots): string {
  const bits: string[] = [];
  if (slots.clinicInFocus) bits.push(`clinic in focus: ${slots.clinicInFocus}`);
  if (slots.lastLocation) bits.push(`last location: ${slots.lastLocation}`);
  if (slots.treatmentsDiscussed.length)
    bits.push(`treatments discussed: ${slots.treatmentsDiscussed.join(", ")}`);
  const body = bits.length ? bits.join("; ") : "(nothing yet)";
  return clip(`KNOWN_SO_FAR: ${body}`, CAP.slots);
}

function summaryBlock(summary?: string): string | null {
  const s = (summary ?? "").trim();
  if (!s) return null;
  return clip(`CONVERSATION_SUMMARY:\n${s}`, CAP.summary);
}

function recentTurnsBlock(turns: TurnMsg[]): string | null {
  if (!turns.length) return null;
  const lines = turns.map(
    (t) => `${t.role === "user" ? "USER" : "ASSISTANT"}: ${t.content}`
  );
  return clip(`RECENT_TURNS:\n${lines.join("\n")}`, CAP.recentTurns);
}

// ──────────────────────────────────────────────────────────────────────────
// Assemble the single user message
// ──────────────────────────────────────────────────────────────────────────
export function buildUserMessage(
  currentQuestion: string,
  g: GatheredContext,
  memory: MemoryInput
): string {
  const blocks: (string | null)[] = [
    taxonomyBlock(memory.catalog),
    siteFeaturesBlock(),
    resolvedEntitiesBlock(g.search),
    pageContextBlock(g),
    clinicBlock(g.clinic),
    searchBlock(g.search),
    resultFactsBlock(g.search),
    catalogBlock(g.treatments, g.concerns),
    slotsBlock(memory.slots),
    summaryBlock(memory.summary),
    recentTurnsBlock(memory.recentTurns),
    `CURRENT_QUESTION: ${currentQuestion}`,
  ];
  return blocks.filter(Boolean).join("\n\n");
}
