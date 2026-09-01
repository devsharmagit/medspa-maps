import {
  buildSearchSeoContent,
  type SearchSeoInput,
} from "@/lib/search/seo-content";

/**
 * Server-rendered SEO copy for /search. A plain server component (no hooks, no
 * "use client") so the paragraph lands in the initial HTML for crawlers/AI bots
 * — the interactive results/map below it are client-rendered and carry no prose.
 *
 * Renders nothing when there's genuinely nothing to say. The heading is an <h2>
 * because SearchResults already renders the page <h1>.
 */
export function SearchSeoContent(props: SearchSeoInput) {
  const content = buildSearchSeoContent(props);
  if (!content) return null;

  // Split the heading so the treatment/condition/location term renders in the
  // brand's Fraunces italic accent (the site's signature heading treatment).
  const { heading, accent } = content;
  const at = accent ? heading.indexOf(accent) : -1;
  const before = at >= 0 ? heading.slice(0, at) : heading;
  const after = at >= 0 ? heading.slice(at + accent.length) : "";

  return (
    <section
      aria-label="About these results"
      className="mx-auto w-full max-w-[1380px] px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-[22px] border border-[#F1E4EC] bg-[linear-gradient(135deg,#FCF6FA_0%,#FDFAF6_52%,#FBF3F7_100%)] px-6 py-7 shadow-[0_6px_28px_rgba(170,78,179,0.06)] sm:px-9 sm:py-9">
        {/* Decorative brand glow — purely visual. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[radial-gradient(circle,rgba(195,65,215,0.12),transparent_68%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 size-56 rounded-full bg-[radial-gradient(circle,rgba(222,127,76,0.10),transparent_70%)]"
        />

        <div className="relative flex flex-col gap-4">
          <h2 className="font-montserrat text-[23px] font-semibold leading-[1.16] tracking-[-0.03em] text-[#2c2b29] sm:text-[30px]">
            {before}
            <span className="font-fraunces font-normal italic text-brand-magenta">
              {accent}
            </span>
            {after}
          </h2>

          {/* Gradient accent rule */}
          <span
            aria-hidden
            className="h-[3px] w-14 rounded-full bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)]"
          />

          {content.paragraphs.map((p, i) => (
            <p
              key={i}
              className="font-montserrat text-[15px] leading-[1.75] text-zinc-600 sm:text-[16px]"
            >
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
