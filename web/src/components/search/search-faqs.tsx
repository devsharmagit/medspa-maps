import { LandingFaq } from "@/components/landing/landing-faq";
import { CONDITION_PAGES } from "@/lib/landing/conditions";
import { TREATMENT_PAGES } from "@/lib/landing/treatments";
import type { LandingContent } from "@/lib/landing/types";

/**
 * Renders the matching landing page's FAQs at the bottom of /search when the
 * query is one of our 8 guide treatments/conditions; otherwise renders nothing.
 *
 * Matching is by exact normalized token (not substring), sourced from each
 * entry's `searchCta` (the canonical inbound link), `slug`, and `shortName` —
 * so e.g. `q=Botox`, `q=hydrafacial`/`facials`, `condition=fine-lines-wrinkles`
 * all resolve, but `q=kybella` or a location-only search resolve to nothing.
 */

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

function buildIndex() {
  const byQ = new Map<string, LandingContent>();
  const byCondition = new Map<string, LandingContent>();

  for (const entry of [...Object.values(TREATMENT_PAGES), ...Object.values(CONDITION_PAGES)]) {
    const qTokens = new Set<string>([norm(entry.slug), norm(entry.shortName)]);

    const qs = entry.searchCta.href.split("?")[1] ?? "";
    const params = new URLSearchParams(qs);
    const ctaQ = params.get("q");
    const ctaCondition = params.get("condition");
    if (ctaQ) qTokens.add(norm(ctaQ));
    if (ctaCondition) byCondition.set(norm(ctaCondition), entry);

    // Extra aliases (e.g. veins → spider-veins + varicose-veins concern slugs).
    for (const c of entry.searchAliases?.conditions ?? []) byCondition.set(norm(c), entry);
    for (const qv of entry.searchAliases?.queries ?? []) qTokens.add(norm(qv));

    for (const t of qTokens) if (t && !byQ.has(t)) byQ.set(t, entry);
  }

  return { byQ, byCondition };
}

const INDEX = buildIndex();

function matchEntry(q: string, condition: string): LandingContent | null {
  const c = norm(condition);
  if (c) {
    const hit = INDEX.byCondition.get(c) ?? INDEX.byQ.get(c);
    if (hit) return hit;
  }
  const qq = norm(q);
  if (qq) {
    const hit = INDEX.byQ.get(qq) ?? INDEX.byCondition.get(qq);
    if (hit) return hit;
  }
  return null;
}

export function SearchFaqs({ q, condition }: { q: string; condition: string }) {
  const entry = matchEntry(q, condition);
  if (!entry) return null;

  return (
    <div className="mx-auto w-full max-w-[1380px] px-4 pb-4 sm:px-6">
      <LandingFaq faqs={entry.faqs} subject={entry.shortName} />
    </div>
  );
}
