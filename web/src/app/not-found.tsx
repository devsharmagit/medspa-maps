import Link from "next/link";
import { ArrowRight, Home, MapPin, Sparkles } from "lucide-react";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "Page Not Found — Medspa Map",
};

const quickLinks = [
  { label: "Find a Clinic", href: "/search", icon: MapPin },
  { label: "Browse Treatments", href: "/treatments", icon: Sparkles },
  { label: "Back to Home", href: "/", icon: Home },
];

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-[#FDFDFD] text-zinc-950 overflow-x-clip">
      {/* Header band */}
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      {/* Content */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-16 text-center sm:py-24">
        {/* Soft brand glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-[90px] sm:h-[560px] sm:w-[560px]"
          style={{ background: "radial-gradient(circle, #EDA5F2 0%, rgba(222,127,88,0.4) 55%, transparent 75%)" }}
          aria-hidden
        />

        {/* 404 */}
        <span
          className="bg-clip-text font-fraunces text-[110px] font-light italic leading-none tracking-tight text-transparent sm:text-[180px]"
          style={{ backgroundImage: "linear-gradient(90deg, #DE7F4C 0%, #C341D7 100%)" }}
        >
          404
        </span>

        <h1 className="mt-4 font-montserrat text-[28px] font-medium leading-[116%] tracking-[-0.03em] text-[#373634] sm:text-[42px]">
          This page took a{" "}
          <span className="font-fraunces italic font-normal text-[#CF5D9A]">day off</span>
        </h1>

        <p className="mt-4 max-w-[520px] font-montserrat text-[15px] leading-[160%] text-[#727272] sm:text-[16px]">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
          Let&apos;s get you back to finding the right medspa &amp; treatment near you.
        </p>

        {/* Primary CTAs */}
        <div className="mt-8 flex w-full max-w-[420px] flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/"
            className="inline-flex h-[50px] items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-7 font-montserrat text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Home className="size-[18px]" />
            Back to Home
          </Link>
          <Link
            href="/search"
            className="inline-flex h-[50px] items-center justify-center gap-2 rounded-[10px] border border-[#E3CED8] bg-white px-7 font-montserrat text-[15px] font-semibold text-[#CF5B9D] transition-colors hover:bg-pink-50"
          >
            Find a Clinic
            <ArrowRight className="size-[18px]" />
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {quickLinks.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="group inline-flex items-center gap-2 rounded-full border border-[#EFE1EF] bg-white px-4 py-2 font-montserrat text-[13px] font-medium text-[#616161] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.03)] transition-all hover:border-[#CB97CE] hover:text-[#CF5D9A]"
            >
              <Icon className="size-4 text-[#CF5D9A]" />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
