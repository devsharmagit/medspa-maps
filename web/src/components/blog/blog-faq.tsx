import { ChevronDown } from "lucide-react";

import type { BlogFaq } from "@/lib/blog";

/**
 * FAQ list rendered as native <details>/<summary> — no JS, SEO-friendly, and
 * mirrors the FAQPage JSON-LD emitted alongside it. Same pattern as the Botox
 * treatment page.
 */
export function BlogFaqSection({ faqs }: { faqs: BlogFaq[] }) {
  if (!faqs.length) return null;
  return (
    <section aria-labelledby="faq-heading" className="mt-14">
      <h2
        id="faq-heading"
        className="font-montserrat text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#373634] sm:text-[28px]"
      >
        Frequently asked questions
      </h2>
      <div className="mt-6 divide-y divide-[#F0E2EC] border-y border-[#F0E2EC]">
        {faqs.map((faq, i) => (
          <details key={i} className="group py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-montserrat text-[16px] font-medium text-[#373634] sm:text-[17px]">
              {faq.q}
              <ChevronDown
                className="size-5 shrink-0 text-[#CF5B9D] transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="pb-4 pr-8 font-montserrat text-[15px] leading-[1.7] text-zinc-600">
              {faq.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
