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
  SearchResult,
  TreatmentInfo,
  ConcernInfo,
} from "@/lib/chat/data";
import type { PageContext, Slots } from "@/lib/chat/intent";

export interface TurnMsg {
  role: "user" | "assistant";
  content: string;
}

export interface GatheredContext {
  page: PageContext;
  clinic?: ClinicContext | null;
  search?: SearchResult | null;
  treatments?: TreatmentInfo[];
  concerns?: ConcernInfo[];
}

export interface MemoryInput {
  summary?: string;
  slots: Slots;
  /** recent raw turns EXCLUDING the current question (already trimmed) */
  recentTurns: TurnMsg[];
}

// Per-block character caps (~4 chars/token).
const CAP = {
  pageContext: 600,
  clinic: 800,
  searchResults: 1400,
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
function taxonomyBlock(): string {
  const t = CANONICAL_SERVICES.map((s) => `${s.name} (/search?q=${s.slug})`).join(
    "; "
  );
  const c = CANONICAL_CONCERNS.map((x) => `${x.name} (/search?condition=${x.slug})`).join(
    "; "
  );
  return `SITE_TAXONOMY:\nTreatments — ${t}\nConcerns — ${c}`;
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
  const body =
    `CLINIC_IN_FOCUS:\n` +
    `Name: ${clinic.name} (${clinic.url})\n` +
    `Location: ${[clinic.city, clinic.state].filter(Boolean).join(", ") || "unknown"}\n` +
    (rt ? `Rating: ${rt}\n` : "") +
    `Services offered (the ONLY services this clinic offers — if a treatment is not in this list, this clinic does not offer it): ${services}\n` +
    `Booking: ${clinic.hasBooking ? "available on their page" : "not listed"}`;
  return clip(body, CAP.clinic);
}

function searchBlock(search: SearchResult | null | undefined): string | null {
  if (!search) return null;
  if (search.unavailable) {
    return `SEARCH_RESULTS: SEARCH_UNAVAILABLE\nClinic search could not run this time. Tell the user search is briefly unavailable and point them to ${search.search_page}.`;
  }
  if (search.count === 0) {
    return `SEARCH_RESULTS: NONE_FOUND\nNo clinics matched. Do NOT name any clinic. Suggest broadening the location or trying a related treatment, and offer the browse page ${search.search_page}.`;
  }
  const lines = search.clinics.map((c) => {
    const loc = [c.city, c.state].filter(Boolean).join(", ") || "location n/a";
    const svc = c.treatments.slice(0, 3).join(", ") || "services n/a";
    const rt = ratingText(c.rating, c.reviews);
    // Omit rating entirely when the clinic has none (don't say "no rating").
    const segs = [
      `${c.name} — ${loc}`,
      rt,
      `offers ${svc}`,
      c.booking_url ? "booking available" : "",
      `link: ${c.url}`,
    ].filter(Boolean);
    return `- ${segs.join("; ")}`;
  });
  const header = `SEARCH_RESULTS: ${search.count} clinic(s). Use ONLY these; use each link exactly as written. Full results: ${search.search_page}`;
  return clip([header, ...lines].join("\n"), CAP.searchResults);
}

function catalogBlock(
  treatments: TreatmentInfo[] | undefined,
  concerns: ConcernInfo[] | undefined
): string | null {
  const parts: string[] = [];
  for (const t of treatments ?? []) {
    if (!t.found) continue;
    const price =
      t.price_from != null ? `from $${t.price_from}/${t.price_unit ?? "unit"}` : "varies";
    const treats = (t.treats_concerns ?? [])
      .map((c) => c.name)
      .slice(0, 4)
      .join(", ");
    parts.push(
      `TREATMENT ${t.name} (${t.url}): ${t.summary} ` +
        `Category: ${t.category}. Typical cost: ${price}. Time: ${t.treatment_time}. ` +
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
    taxonomyBlock(),
    pageContextBlock(g),
    clinicBlock(g.clinic),
    searchBlock(g.search),
    catalogBlock(g.treatments, g.concerns),
    slotsBlock(memory.slots),
    summaryBlock(memory.summary),
    recentTurnsBlock(memory.recentTurns),
    `CURRENT_QUESTION: ${currentQuestion}`,
  ];
  return blocks.filter(Boolean).join("\n\n");
}
