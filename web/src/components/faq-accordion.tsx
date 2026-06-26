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
    <section className="mt-12">
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        Frequently Asked{" "}
        <span className="font-fraunces italic font-normal">Questions</span>
      </h2>
      <p className="mt-1.5 text-sm text-zinc-500">
        Common questions about {entityName}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-zinc-50"
                aria-expanded={isOpen}
              >
                <span className="text-base font-medium text-zinc-900 pr-6">
                  {faq.q}
                </span>
                <ChevronDown
                  className={`size-5 shrink-0 text-zinc-400 transition-transform duration-300 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Answer panel with animated height */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{
                  gridTemplateRows: isOpen ? "1fr" : "0fr",
                }}
              >
                <div className="overflow-hidden">
                  <div className="px-6 pb-5 pt-1">
                    <div className="text-sm leading-relaxed text-zinc-600">
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
