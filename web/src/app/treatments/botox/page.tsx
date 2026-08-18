import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  TriangleAlert,
} from "lucide-react";

import { Footer } from "@/components/footer";
import { ListingHero } from "@/components/shared/listing-hero";
import { Button } from "@/components/ui/button";
import { BotoxLocationSearch } from "./botox-location-search";

/**
 * Standalone, static SEO page for Botox — proof-of-concept for a future
 * templated per-treatment page. Hardcoded content on purpose (no DB / no
 * dynamic route yet); the editorial source of truth lives alongside this file
 * in `docs/botox-seo-page-content.md`. Every CTA funnels to `/search?q=Botox`,
 * the site's established treatment deep-link.
 *
 * YMYL note: this is an educational page, not medical advice. It carries a
 * disclaimer, cited sources, contraindications, and "results vary" language.
 */

export const dynamic = "force-static";

const SEARCH_HREF = "/search?q=Botox";
const RUMA_URL = "https://ruma.com/services/botox-in-lehi-ut/";
const RUMA_PROFILE = "/practices/ruma-medical";
const LAST_UPDATED = "August 19, 2026";
const LAST_REVIEWED_ISO = "2026-08-19";

export const metadata: Metadata = {
  title: "Botox Guide: Cost, Areas, Safety & Providers Near You",
  description:
    "What Botox is, how it works, what it costs, areas treated, safety and side effects, plus find licensed Botox providers near you on Med Spa Maps.",
  alternates: { canonical: "/treatments/botox" },
  openGraph: {
    type: "article",
    title: "Botox Guide: Cost, Areas, Safety & Providers Near You",
    description:
      "What Botox is, how it works, what it costs, areas treated, safety and side effects, plus find licensed Botox providers near you.",
    url: "/treatments/botox",
    siteName: "Med Spa Maps",
  },
};

// ─── Content data ─────────────────────────────────────────────────────────────

const AT_A_GLANCE = [
  { icon: Sparkles, label: "Best for", value: "Dynamic wrinkles" },
  { icon: Clock, label: "Appointment", value: "20–30 mins" },
  { icon: Star, label: "Results last", value: "3–4 months" },
  { icon: ShieldCheck, label: "Downtime", value: "Little to none" },
];

const AREAS: { area: string; treats: string; units: string }[] = [
  { area: "Forehead lines", treats: "Horizontal lines when you raise your brows", units: "10–30" },
  { area: "Frown lines (“11s”)", treats: "Vertical lines between the brows (glabella)", units: "~20" },
  { area: "Crow's feet", treats: "Lines fanning from the outer eyes", units: "~20" },
  { area: "Bunny lines", treats: "Wrinkles on the sides of the nose", units: "5–10" },
  { area: "Brow lift", treats: "Subtle lift to open the eyes", units: "5–10" },
  { area: "Lip flip / lip lines", treats: "Softens vertical lip lines; gentle outward roll", units: "4–8" },
  { area: "Chin (dimpling)", treats: "Smooths a pebbled or dimpled chin", units: "5–10" },
  { area: "Masseter / jaw slimming", treats: "Relaxes the jaw muscle; slims the lower face; eases clenching", units: "20–30 / side" },
  { area: "Neck bands (platysma)", treats: "Softens vertical neck cords", units: "25–50" },
  { area: "Hyperhidrosis (underarms)", treats: "Reduces excessive sweating (a medical use)", units: "~50 / area" },
];

const AFTERCARE = [
  "Stay upright for about 4 hours; avoid lying down or napping.",
  "Don't rub, massage, or apply pressure to the treated areas for about 24 hours.",
  "Skip strenuous exercise, saunas, and alcohol for the rest of the day.",
  "Mild redness, small bumps, or minor bruising usually settle within hours.",
];

const CHOOSE_PROVIDER = [
  "A licensed medical provider (physician, PA, NP, or RN) under proper medical supervision.",
  "Experience specifically with injectables and the areas you care about.",
  "A real consultation that reviews your health history and sets natural goals.",
  "Genuine before and after photos and reviews from actual patients.",
  "Transparent pricing, per unit or per area, with no pressure.",
  "A clean, licensed medical facility.",
];

const RED_FLAGS =
  "Prices far below local norms, no medical intake, no licensed provider on site, or reluctance to answer questions.";

const RUMA_SERVICES = ["Botox", "Dermal Fillers", "Microneedling", "Laser", "PRP"];

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Does Botox hurt?",
    answer:
      "Most people feel only a quick pinch. The needle is very fine and appointments are brief; some providers use a topical numbing cream or ice for comfort.",
  },
  {
    question: "How long does Botox last?",
    answer:
      "Typically 3–4 months. Results begin in 3–5 days and peak around two weeks, then gradually fade as muscle movement returns.",
  },
  {
    question: "When will I see results?",
    answer:
      "Usually within 3–5 days, with the full effect at about 10–14 days.",
  },
  {
    question: "Is there any downtime?",
    answer:
      "Little to none. Most people return to normal activities right away, avoiding exercise, lying down, and rubbing the area for the rest of the day.",
  },
  {
    question: "How much does Botox cost?",
    answer:
      "It's usually priced per unit (roughly $10–$20 nationally), so the total depends on how many units you need. Prices vary by provider and region.",
  },
  {
    question: "Is Botox safe?",
    answer:
      "Botox has a long safety record when administered by a licensed medical provider, and side effects are usually mild and temporary. It's still a prescription treatment, so discuss your history with a provider.",
  },
  {
    question: "Will Botox make me look frozen?",
    answer:
      "Not when it's dosed and placed well. The goal of a skilled injector is natural, softened movement, not a frozen look.",
  },
  {
    question: "Botox vs. Dysport or Xeomin, what's the difference?",
    answer:
      "They're all botulinum toxin type A neuromodulators that work the same way; they differ slightly in formulation, spread, and onset. A provider can recommend the best fit.",
  },
  {
    question: "Can I combine Botox with other treatments?",
    answer:
      "Yes. Botox is commonly combined with dermal fillers, and with treatments like microneedling or facials, as part of a plan.",
  },
  {
    question: "Who should not get Botox?",
    answer:
      "People who are pregnant or breastfeeding, have certain neuromuscular disorders, have a relevant allergy, or have an active infection at the injection site. Always consult a licensed provider.",
  },
];

const SOURCES: { label: string; href: string }[] = [
  { label: "Cleveland Clinic: Botulinum toxin injections", href: "https://my.clevelandclinic.org/health/treatments/8312-botulinum-toxin-injections" },
  { label: "Botox Cosmetic (AbbVie): official product FAQ", href: "https://www.botoxcosmetic.com/how-it-works/frequently-asked-questions" },
  { label: "American Society of Plastic Surgeons: Botox statistics", href: "https://www.plasticsurgery.org/cosmetic-procedures/botulinum-toxin" },
  { label: "Medical News Today: Botox vs. fillers", href: "https://www.medicalnewstoday.com/articles/320510" },
];

// ─── Structured data (JSON-LD @graph) ─────────────────────────────────────────

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "MedicalWebPage",
      name: "Botox: What It Is, How It Works, Cost and How to Find a Provider Near You",
      description: metadata.description,
      inLanguage: "en-US",
      lastReviewed: LAST_REVIEWED_ISO,
      medicalAudience: { "@type": "MedicalAudience", audienceType: "Patient" },
      specialty: "Dermatology",
      about: { "@type": "Drug", name: "Botox (botulinum toxin type A)" },
    },
    {
      "@type": "MedicalProcedure",
      name: "Botox",
      procedureType: "https://schema.org/NoninvasiveProcedure",
      bodyLocation: "Face",
      howPerformed:
        "A licensed medical provider injects small doses of botulinum toxin type A into targeted facial muscles using a fine needle to temporarily relax them and soften dynamic wrinkles.",
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "/" },
        { "@type": "ListItem", position: 2, name: "Treatments", item: "/treatments" },
        { "@type": "ListItem", position: 3, name: "Botox", item: "/treatments/botox" },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ],
};

// ─── Small presentational helpers ─────────────────────────────────────────────

function SectionHeading({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <h2 className="font-montserrat text-[26px] font-medium leading-[116%] tracking-[-0.03em] text-[#373634] sm:text-[32px]">
      {children}
      {accent ? <> <span className="font-fraunces font-normal italic">{accent}</span></> : null}
    </h2>
  );
}

function Cta({ label = "Find Botox providers near you" }: { label?: string }) {
  return (
    <Button asChild variant="gradient" size="search">
      <Link href={SEARCH_HREF}>
        <MapPin className="size-[18px]" aria-hidden />
        {label}
        <ArrowRight className="size-[18px]" aria-hidden />
      </Link>
    </Button>
  );
}

function Credit() {
  return (
    <figcaption className="mt-2 text-center text-[12px] text-zinc-400">
      Photo:{" "}
      <a href={RUMA_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#CF5B9D]">
        Ruma Medical, Lehi UT
      </a>
    </figcaption>
  );
}

/**
 * Featured practice card — deliberately mirrors the ClinicCard used in the home
 * page carousel (`components/hero/find-clinic-section.tsx`) so the design stays
 * consistent across the site. Static Ruma data; images are their own,
 * non-patient marketing assets, credited below the card.
 */
function RumaCard() {
  return (
    <div className="mt-8">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#CF5B9D]">
        Featured provider
      </span>
      <div
        className="mt-3 w-full overflow-hidden rounded-[18px] border-2 border-white bg-white"
        style={{ boxShadow: "0px 4px 21.3px #E2D8E6" }}
      >
        {/* Cover */}
        <div className="relative h-[200px] w-full overflow-hidden sm:h-[260px]">
          <Image
            src="/images/botox/ruma-clinic.webp"
            alt="Interior of Ruma Medical, a med spa in Lehi, Utah"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 820px"
          />
          <div className="absolute left-[22px] top-[23px] rounded bg-[#D3A845] px-[10px] py-1">
            <span className="font-montserrat text-[14px] font-semibold uppercase tracking-[-0.02em] text-white">
              Featured
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white px-4 pb-5 pt-5 sm:px-[30px] sm:pb-[24px] sm:pt-[24px]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-[11px]">
              <div className="flex h-[50px] w-[57px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[#E5E5E5] bg-[#faf5fa]">
                <Image
                  src="/images/botox/ruma-logo.png"
                  alt="Ruma Medical logo"
                  width={48}
                  height={48}
                  className="h-full w-full object-contain p-1"
                />
              </div>
              <div className="flex flex-col gap-[4px]">
                <div className="flex items-center gap-[4px]">
                  <h3 className="font-montserrat text-[20px] font-medium leading-[116.02%] tracking-[0.02em] text-[#383838] line-clamp-1">
                    Ruma Medical
                  </h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
                    <path
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      stroke="#CF5B9D"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="flex items-center gap-[13px] text-[12px] text-[#727272]">
                  <span className="font-montserrat font-medium tracking-[0.02em] line-clamp-1">Lehi, UT</span>
                </div>
              </div>
            </div>

            {/* Thumbnail */}
            <div className="hidden shrink-0 items-center gap-[9px] sm:flex">
              <div className="relative h-[56px] w-[76px] overflow-hidden rounded-[6px]">
                <Image
                  src="/images/botox/ruma-botox-service.webp"
                  alt="Botox treatment at Ruma Medical"
                  fill
                  className="object-cover"
                  sizes="76px"
                />
              </div>
            </div>
          </div>

          {/* Rating */}
          <div className="mt-[14px] flex items-center gap-[6px] text-[12px] text-[#727272]">
            <span className="font-montserrat tracking-[-0.02em]">5.0</span>
            <div className="flex items-center gap-[4px]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-[14px] w-[14px] fill-[#FFBA19] text-[#FFBA19]" />
              ))}
            </div>
            <span className="font-montserrat tracking-[-0.02em]">(400+)</span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-4">
            {/* Treatment tags */}
            <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
              {RUMA_SERVICES.map((t) => (
                <span
                  key={t}
                  className="rounded border-[0.5px] border-[#DFDFDF] bg-[#F5F5F5] px-[10px] py-1 font-montserrat text-[12px] tracking-[0.02em] text-[#7F7F7F]"
                >
                  {t}
                </span>
              ))}
              <Link
                href={RUMA_PROFILE}
                className="rounded border-[0.5px] border-[#CF5B9D]/50 bg-[#FCEFF6] px-[10px] py-1 font-montserrat text-[12px] font-semibold tracking-[0.02em] text-[#CF5B9D] transition-colors hover:bg-[#F8DEEC]"
              >
                + More
              </Link>
            </div>

            {/* CTA buttons */}
            <div className="mt-1 flex items-center gap-[9px] sm:mt-[20px] sm:shrink-0">
              <Link
                href={RUMA_PROFILE}
                className="flex h-[43px] flex-1 items-center justify-center rounded-lg border border-[#CF5B9D] px-4 font-montserrat text-[14px] font-semibold text-[#CF5B9D] transition-colors hover:bg-pink-50 sm:w-[120px] sm:flex-none"
              >
                View profile
              </Link>
              <a
                href={RUMA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-[43px] flex-1 items-center justify-center rounded-lg bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-4 font-montserrat text-[14px] font-semibold text-white transition-opacity hover:opacity-90 sm:w-[127px] sm:flex-none"
              >
                Book now
              </a>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-zinc-400">Images courtesy of Ruma Medical, Lehi UT.</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BotoxPage() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950 relative overflow-x-hidden"
      style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ListingHero
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Treatments", href: "/treatments" },
          { label: "Botox" },
        ]}
        title="Your complete guide to"
        accent="Botox"
        subtitle="Botox is the most-requested aesthetic treatment in the country, and one of the most misunderstood. Here's what it does, the areas it treats, what it costs, how long it lasts, and how to choose a qualified injector."
      >
        <div className="flex flex-col gap-3">
          <Cta />
          <p className="text-[12px] italic leading-relaxed text-zinc-500">
            Educational information only, not medical advice. Botox is a prescription treatment
            that must be administered by a licensed medical provider.
          </p>
        </div>
      </ListingHero>

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 sm:px-6">
        <article className="max-w-[860px] pb-10">
        {/* At-a-glance chips */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AT_A_GLANCE.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex flex-col gap-1 rounded-[14px] border border-[#F0E2EC] bg-white p-4 shadow-[0px_6px_14px_rgba(170,78,179,0.06)]"
            >
              <Icon className="size-5 text-[#CF5B9D]" aria-hidden />
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                {label}
              </span>
              <span className="text-[15px] font-semibold text-[#373634]">{value}</span>
            </div>
          ))}
        </div>

        {/* 1. What is Botox */}
        <section className="mt-14 scroll-mt-24" id="what-is-botox">
          <SectionHeading>What is Botox?</SectionHeading>
          <div className="mt-5 grid gap-6 sm:grid-cols-[1.4fr_1fr] sm:items-start">
            <div className="space-y-4 text-[16px] leading-[1.7] text-zinc-700">
              <p>
                Botox® is the brand name for a purified form of botulinum toxin type A, a
                prescription injectable used to temporarily relax specific muscles. In aesthetics,
                it softens the fine lines and wrinkles caused by repeated facial expressions like
                frowning, squinting, and raising your brows.
              </p>
              <p>
                It's been FDA-approved for cosmetic use since 2002 and is one of the most-studied
                aesthetic treatments in the world. “Botox” is often used as a catch-all, but it's
                one of several neuromodulator brands. Dysport, Xeomin, Jeuveau and Daxxify all work
                the same way.
              </p>
            </div>
            <figure className="overflow-hidden rounded-[18px] border border-[#F0E2EC] bg-white shadow-[0px_10px_30px_rgba(123,45,107,0.10)]">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="/images/botox/ruma-botox-service.webp"
                  alt="A licensed provider administering a Botox injection to a client"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 320px"
                />
              </div>
              <div className="px-3 pb-3 pt-2">
                <Credit />
              </div>
            </figure>
          </div>
        </section>

        {/* 2. How Botox works */}
        <section className="mt-14 scroll-mt-24" id="how-it-works">
          <SectionHeading>How Botox works</SectionHeading>
          <div className="mt-5 space-y-4 text-[16px] leading-[1.7] text-zinc-700">
            <p>
              Facial wrinkles come in two types. <strong className="font-semibold text-[#373634]">Dynamic
              wrinkles</strong> appear when you make expressions: the “11s” between your brows,
              forehead lines, and crow's feet. <strong className="font-semibold text-[#373634]">Static
              wrinkles</strong> are visible at rest.
            </p>
            <p>
              Botox works on dynamic wrinkles. It temporarily blocks the nerve signals that tell a
              treated muscle to contract, so the muscle relaxes and the overlying skin smooths out.
              Because the muscle simply rests, results look natural, and you keep normal expression
              when it's dosed and placed well. It does little for static wrinkles or lost volume;
              those are better addressed with resurfacing or dermal fillers.
            </p>
          </div>
        </section>

        {/* 3. Areas & uses */}
        <section className="mt-14 scroll-mt-24" id="areas">
          <SectionHeading>What Botox treats: <span className="font-fraunces font-normal italic">areas &amp; uses</span></SectionHeading>
          <p className="mt-4 text-[16px] leading-[1.7] text-zinc-700">
            Botox is used across the upper face and, increasingly, for jaw slimming, a lip flip,
            neck bands, and excessive sweating. Typical dosing varies by person, anatomy, and goal.
          </p>
          <div className="mt-6 overflow-x-auto rounded-[18px] border border-[#F0E2EC] bg-white shadow-[0px_6px_14px_rgba(170,78,179,0.06)]">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#F0E2EC] bg-[#faf5fa]">
                  <th className="px-5 py-3 text-[13px] font-semibold text-[#7b2d6b]">Area</th>
                  <th className="px-5 py-3 text-[13px] font-semibold text-[#7b2d6b]">What it addresses</th>
                  <th className="px-5 py-3 text-[13px] font-semibold text-[#7b2d6b] whitespace-nowrap">Typical units*</th>
                </tr>
              </thead>
              <tbody>
                {AREAS.map((row) => (
                  <tr key={row.area} className="border-b border-[#F5EEF3] last:border-0">
                    <td className="px-5 py-3 text-[14px] font-medium text-[#373634]">{row.area}</td>
                    <td className="px-5 py-3 text-[14px] text-zinc-600">{row.treats}</td>
                    <td className="px-5 py-3 text-[14px] font-semibold text-[#CF5B9D] whitespace-nowrap">{row.units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] italic text-zinc-500">
            *National ranges for orientation only, not a quote. Actual dosing is set by your
            provider. Botox also has established medical uses (chronic migraine, hyperhidrosis,
            TMJ/jaw clenching) that a medical provider administers.
          </p>
        </section>

        {/* 4. Cost */}
        <section className="mt-14 scroll-mt-24" id="cost">
          <SectionHeading>Botox cost: <span className="font-fraunces font-normal italic">what to expect</span></SectionHeading>
          <div className="mt-5 space-y-4 text-[16px] leading-[1.7] text-zinc-700">
            <p>
              Botox is usually priced <strong className="font-semibold text-[#373634]">per unit</strong> or,
              at some practices, per treatment area. Nationally, per-unit pricing runs roughly
              <strong className="font-semibold text-[#373634]"> $10–$20</strong>, and a typical single
              session averages around <strong className="font-semibold text-[#373634]">$400–$600</strong>,
              depending on how many units you need. As a rough guide, frown lines might take about
              20 units, the forehead 10–30, and crow's feet about 20, so a full upper face is often
              50–85 units.
            </p>
            <p>
              Cost depends on your area, the injector's experience, the number of units, and the
              brand used. Be cautious of prices far below local norms; deep discounts can signal
              over-dilution or inexperience. Prices vary widely by provider and region.
            </p>
          </div>
        </section>

        {/* 5. How long it lasts */}
        <section className="mt-14 scroll-mt-24" id="how-long">
          <SectionHeading>How long does Botox last?</SectionHeading>
          <div className="mt-5 space-y-4 text-[16px] leading-[1.7] text-zinc-700">
            <p>
              Botox isn't instant and it isn't permanent. You'll typically start to see results in
              <strong className="font-semibold text-[#373634]"> 3–5 days</strong>, with the full effect at
              about <strong className="font-semibold text-[#373634]">10–14 days</strong>. Results generally
              last <strong className="font-semibold text-[#373634]">3–4 months</strong>, then gradually fade
              as muscle movement returns.
            </p>
            <p>
              With consistent treatment, some people find results last a little longer over time as
              the treated muscles weaken with regular use. When results fade, wrinkles return to
              their prior state, and Botox doesn't make lines worse.
            </p>
          </div>
        </section>

        {/* 6. What to expect / aftercare */}
        <section className="mt-14 scroll-mt-24" id="aftercare">
          <SectionHeading>What to expect: <span className="font-fraunces font-normal italic">treatment day &amp; aftercare</span></SectionHeading>
          <p className="mt-5 text-[16px] leading-[1.7] text-zinc-700">
            A Botox appointment is quick, usually 20–30 minutes with little to no downtime. After a
            brief consultation, your provider cleanses the area and makes a series of tiny injections
            with a very fine needle; most people describe it as a quick pinch. You can generally
            return to your day right away.
          </p>
          <div className="mt-6 rounded-[18px] border border-[#F0E2EC] bg-white p-6 shadow-[0px_6px_14px_rgba(170,78,179,0.06)]">
            <h3 className="text-[15px] font-semibold text-[#373634]">Common aftercare guidance</h3>
            <p className="mb-4 mt-1 text-[13px] text-zinc-500">Always follow your provider's specific instructions.</p>
            <ul className="space-y-3">
              {AFTERCARE.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.6] text-zinc-700">
                  <Check className="mt-0.5 size-[18px] shrink-0 text-[#68bf52]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 7. Safety */}
        <section className="mt-14 scroll-mt-24" id="safety">
          <SectionHeading>Safety, side effects &amp; <span className="font-fraunces font-normal italic">who should avoid it</span></SectionHeading>
          <div className="mt-5 space-y-4 text-[16px] leading-[1.7] text-zinc-700">
            <p>
              Botox has a long, well-documented safety record when administered by a trained,
              licensed medical provider, and cosmetic doses are very small and localized. Still,
              it's a prescription medication with real considerations.
            </p>
            <p>
              <strong className="font-semibold text-[#373634]">Common, temporary side effects</strong>{" "}
              include redness, swelling, or bruising at the injection site and headache. Uncommonly,
              if the product spreads or placement is off, a temporary drooping of an eyelid or brow
              can occur that resolves as the effect wears off.
            </p>
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-[18px] border border-[#F3D9A6]/60 bg-[#FFF8EC] p-5">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-[#D3A845]" aria-hidden />
            <p className="text-[14.5px] leading-[1.6] text-[#6b5a34]">
              <strong className="font-semibold">Who should avoid Botox or talk to a provider first:</strong>{" "}
              people who are pregnant or breastfeeding; anyone with a neuromuscular disorder (e.g.
              myasthenia gravis, ALS); those with a known allergy to any ingredient; and anyone with
              an active skin infection at the injection site. This is not a complete list. A
              licensed provider reviews your history and determines whether Botox is appropriate
              for you.
            </p>
          </div>
        </section>

        {/* 8. Botox vs fillers */}
        <section className="mt-14 scroll-mt-24" id="vs-fillers">
          <SectionHeading>Botox vs. <span className="font-fraunces font-normal italic">dermal fillers</span></SectionHeading>
          <p className="mt-5 text-[16px] leading-[1.7] text-zinc-700">
            People often use “Botox” and “fillers” interchangeably, but they do different jobs.
            <strong className="font-semibold text-[#373634]"> Botox relaxes muscles</strong> to soften
            wrinkles caused by movement (dynamic lines).{" "}
            <strong className="font-semibold text-[#373634]">Dermal fillers add volume.</strong> They plump
            lips, restore cheek volume, and fill static folds and lines present at rest. Many people
            combine both. If your concern is volume loss or deep folds rather than expression lines,
            start with fillers.
          </p>
          <Link
            href="/search?q=dermal-fillers"
            className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#CF5B9D] hover:underline"
          >
            Explore dermal fillers providers
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>

        {/* 9. Preventative */}
        <section className="mt-14 scroll-mt-24" id="preventative">
          <SectionHeading>Preventative Botox: <span className="font-fraunces font-normal italic">when to start</span></SectionHeading>
          <p className="mt-5 text-[16px] leading-[1.7] text-zinc-700">
            “Preventative” (or “baby”) Botox uses smaller doses earlier, often in the mid-to-late
            20s or early 30s, to relax the muscles before repeated expressions etch permanent
            static lines. The idea is to slow the formation of set-in wrinkles rather than treat
            them after the fact. There's no universal “right age”; it depends on your skin, genetics,
            and goals. A provider can tell you whether it makes sense for you.
          </p>
        </section>

        {/* 10. Choose a provider + Featured Ruma */}
        <section className="mt-14 scroll-mt-24" id="choose-provider">
          <SectionHeading>How to choose a <span className="font-fraunces font-normal italic">qualified provider</span></SectionHeading>
          <p className="mt-5 text-[16px] leading-[1.7] text-zinc-700">
            Botox is a medical procedure, and who injects you matters as much as the product. Look
            for:
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {CHOOSE_PROVIDER.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-[14px] border border-[#F0E2EC] bg-white p-4 text-[14.5px] leading-[1.55] text-zinc-700 shadow-[0px_6px_14px_rgba(170,78,179,0.05)]"
              >
                <Check className="mt-0.5 size-[18px] shrink-0 text-[#68bf52]" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-start gap-3 rounded-[14px] border border-[#F1C9C9]/70 bg-[#FDF1F1] p-4">
            <TriangleAlert className="mt-0.5 size-[18px] shrink-0 text-[#C4574F]" aria-hidden />
            <p className="text-[14px] leading-[1.55] text-[#7a4a46]">
              <strong className="font-semibold">Red flags:</strong> {RED_FLAGS}
            </p>
          </div>

          <RumaCard />
        </section>

        {/* 11. FAQ */}
        <section className="mt-16 scroll-mt-24" id="faq">
          <SectionHeading>Frequently asked <span className="font-fraunces font-normal italic">questions</span></SectionHeading>
          <div className="mt-6 flex flex-col gap-3">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-[14px] border border-[#F0E2EC] bg-white px-5 py-4 shadow-[0px_6px_14px_rgba(170,78,179,0.05)] open:shadow-[0px_10px_24px_rgba(170,78,179,0.10)]"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15.5px] font-semibold text-[#373634] marker:content-['']">
                  {faq.question}
                  <ArrowRight className="size-4 shrink-0 rotate-90 text-[#CF5B9D] transition-transform group-open:-rotate-90" aria-hidden />
                </summary>
                <p className="mt-3 text-[14.5px] leading-[1.65] text-zinc-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 12. Final CTA — location search + faint map */}
        <section className="mt-16 scroll-mt-24" id="find-providers">
          <BotoxLocationSearch />
        </section>

        {/* Sources + disclaimer */}
        <section className="mt-14 border-t border-[#EADCE6] pt-8">
          <h2 className="text-[15px] font-semibold text-[#373634]">Sources</h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {SOURCES.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13.5px] text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-[#CF5B9D]"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[12.5px] leading-[1.7] text-zinc-400">
            <strong className="font-semibold text-zinc-500">Medical disclaimer.</strong> Med Spa
            Maps is a directory that helps you find and compare med spas. We are not a medical
            provider and do not provide medical advice. This page is for general education only.
            Botox is a prescription treatment that must be administered by a licensed medical
            professional. Individual results, pricing, and suitability vary; consult a qualified
            provider to determine what's right for you. Last updated {LAST_UPDATED}.
          </p>
        </section>
        </article>
      </div>

      <Footer />
    </main>
  );
}
