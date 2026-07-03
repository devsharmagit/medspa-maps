"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  faqs: FaqItem[];
  /** Page entity name, used for the section heading (e.g. "Botox", "Acne Scars") */
  entityName: string;
}

/**
 * Premium FAQ accordion with smooth open/close animations.
 * Renders both the visible accordion UI and an invisible
 * FAQPage JSON-LD block for SEO structured data.
 */
export function FaqAccordion({ faqs, entityName }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (faqs.length === 0) return null;

  function toggle(idx: number) {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }

  // Build FAQ structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <section>
      <div className="mb-8">
        <h2 className="text-[26px] sm:text-[34px] font-normal leading-[116%] tracking-[-0.04em] text-[#373634]">
          Frequently Asked{" "}
          <span className="font-fraunces italic font-normal">Questions</span>
        </h2>
        <p className="mt-2 text-[16px] leading-[150%] tracking-[0.02em] text-[#727272]">
          Common questions about {entityName}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={`group overflow-hidden rounded-[16px] border transition-all duration-300 ${
                isOpen 
                  ? "border-[#CF5D9A]/30 bg-gradient-to-b from-[#FFF5FA] to-white shadow-[0px_4px_12px_rgba(207,93,154,0.08)]" 
                  : "border-[#EFEFEF] bg-white hover:border-[#DDC3DF] hover:shadow-sm"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="flex w-full items-center justify-between px-5 py-4 sm:px-7 sm:py-5 text-left"
                aria-expanded={isOpen}
              >
                <span className={`text-[16px] pr-6 transition-colors duration-300 ${
                  isOpen ? "font-semibold text-[#CF5D9A]" : "font-medium text-[#383838]"
                }`}>
                  {faq.q}
                </span>
                <div className={`flex shrink-0 items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
                  isOpen ? "bg-[#CF5D9A] text-white shadow-md shadow-[#CF5D9A]/20" : "bg-[#F7F7F7] text-[#9A9A9A] group-hover:bg-[#F0E6F1] group-hover:text-[#CF5D9A]"
                }`}>
                  <ChevronDown
                    className={`size-4 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Answer panel with animated height */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{
                  gridTemplateRows: isOpen ? "1fr" : "0fr",
                }}
              >
                <div className="overflow-hidden">
                  <div className="px-5 sm:px-7 pb-6 pt-1">
                    <div className="text-[15px] leading-[160%] tracking-[0.01em] text-[#616161]">
                      {faq.a}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SEO structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
