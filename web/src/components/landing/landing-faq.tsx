import { ChevronDown } from "lucide-react";

import type { LandingFaq } from "@/lib/landing/types";

/**
 * Centered FAQ using native <details>/<summary> (no client JS). The same `faqs`
 * array feeds `faqPageJsonLd` in the page, so the visible accordion and the
 * FAQPage schema never drift.
 */
export function LandingFaq({ faqs }: { faqs: LandingFaq[] }) {
  if (!faqs.length) return null;
  return (
    <section id="faq" className="mt-20 scroll-mt-28">
      <h2 className="text-center font-montserrat text-[26px] font-medium leading-[116%] tracking-[-0.03em] text-[#373634] sm:text-[32px]">
        Frequently asked <span className="font-fraunces font-normal italic">questions</span>
      </h2>
      <div className="mx-auto mt-8 flex max-w-[760px] flex-col gap-3">
        {faqs.map((faq) => (
          <details
            key={faq.q}
            className="group rounded-[14px] border border-[#F0E2EC] bg-white px-5 py-4 shadow-[0px_6px_14px_rgba(170,78,179,0.05)] open:shadow-[0px_10px_24px_rgba(170,78,179,0.10)]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15.5px] font-semibold text-[#373634] marker:content-['']">
              {faq.q}
              <ChevronDown
                className="size-5 shrink-0 text-[#CF5B9D] transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="mt-3 text-[14.5px] leading-[1.65] text-zinc-600">{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
