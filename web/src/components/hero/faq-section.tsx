import { FaqItem } from "./faq-item";

// ─── Data ─────────────────────────────────────────────────────────────────────
// FAQs focus on the benefits of our vetted listings and how the directory works.

const faqs = [
  {
    question: "What is Med Spa Maps?",
    answer:
      "Med Spa Maps is a trusted directory of vetted med spas across the United States. We pair editorially reviewed listings with patient education, so you can research treatments, compare local practices, and book with confidence — all in one place.",
  },
  {
    question: "Are the med spas listed on Med Spa Maps vetted?",
    answer:
      "Yes. Every practice is editorially reviewed against our quality standards before it's listed. Each listing surfaces real patient reviews, the treatments a practice actually offers, and the concerns it treats — so you compare practices on facts, not ads.",
  },
  {
    question: "Does it cost anything to use Med Spa Maps?",
    answer:
      "No. Med Spa Maps is completely free for patients. You can search treatments, compare local med spas, read reviews, and get directions without creating an account or paying a fee.",
  },
  {
    question: "How do I book an appointment with a practice?",
    answer:
      "When you find a med spa you like, you book directly with the practice — either through the “Book Appointment” link to their own booking page or by calling them. Med Spa Maps never sits between you and your provider, so there are no middleman fees.",
  },
  {
    question: "What treatments and conditions can I search for?",
    answer:
      "You can search by treatment — like Botox, dermal fillers, or laser hair removal — or by the concern you want to address, like acne, fine lines, or hyperpigmentation. We match you with local practices that offer exactly what you're looking for.",
  },
];

// ─── FaqSection ─────────────────────────────────────────────────────────────
// Rendered as a server component with native <details>/<summary> (no client JS)
// plus FAQPage JSON-LD for rich-result eligibility.

export function FaqSection() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <section className="flex w-[calc(100%-2rem)] max-w-[1372px] flex-col items-center gap-8 py-6 min-[1400px]:py-10">
      {/* FAQPage structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h2 className="font-montserrat text-[26px] sm:text-[30px] lg:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634] text-center">
        Frequently asked{" "}
        <span className="font-heading italic">questions</span>
      </h2>

      <div className="flex w-full max-w-[860px] flex-col gap-4">
        {faqs.map((faq) => (
          <FaqItem
            key={faq.question}
            question={faq.question}
            answer={faq.answer}
          />
        ))}
      </div>
    </section>
  );
}
