import Image from "next/image";
import { ShieldCheck } from "lucide-react";

import { HeroHeader } from "@/components/hero/hero-header";
import { HeroSearchBar } from "@/components/hero/hero-search-bar";
import { TreatmentCarousel } from "@/components/hero/treatment-carousel";
import { StarRating } from "@/components/ui/star-rating";
import { cn } from "@/lib/utils";

const trustItems = [
  "10,000+ Verified Listings",
  "Expert-Reviewed Content",
  "2026 Award Winners",
  "No Pay-to-Rank",
] as const;

const avatars = [
  "/images/hero/avatar-1.png",
  "/images/hero/avatar-2.png",
  "/images/hero/avatar-3.png",
  "/images/hero/avatar-4.png",
  "/images/hero/avatar-5.png",
] as const;

export function HeroSection() {
  return (
    <section className="relative flex w-full flex-col items-center">
      <div className="relative flex min-h-[720px] w-full flex-col items-center overflow-hidden pb-14 lg:min-h-[846px] gap-[100px]">
        {/* Background */}
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute inset-0 bg-hero-gradient" />
            <Image
            src="/images/hero/bg-overlay-2.png"
            alt=""
            fill
            className="object-cover object-[70%_center] opacity-40 brightness-50"
            priority
            sizes="100vw"
          />
          <Image
            src="/images/hero/bg-overlay-1.jpg"
            alt=""
            fill
            className="object-cover object-[70%_center] opacity-40"
            priority
            sizes="100vw"
          />
         
        </div>

        <HeroHeader />

        {/* Hero content */}
        <div className="relative z-10 mx-auto flex w-full max-w-[1316px] flex-1 flex-col justify-between gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="flex flex-col gap-8 lg:gap-10">
            {/* Trust badge */}
            <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-white/40 bg-black/25 px-4 py-1.5 backdrop-blur-sm ">
              <Image src={"/images/hero/group.png"} alt="shield icon" width={15} height={15} />
              <span className="text-sm font-semibold tracking-wide sm:text-[17px] bg-gradient-to-r from-[#FFFFFF] to-[#DF67D6] bg-clip-text text-transparent">
                <span className="">TRUSTED MEDSPA DIRECTORY</span>
                <span className=""> + PATIENT EDUCATION</span>
              </span>
            </div>

            {/* Headline */}
            <div className="max-w-[982px] space-y-4">
              <p className="max-w-[753px] text-base font-medium leading-snug text-[#fcfcfc]">
                Explore 10,000+ vetted medspas, read expert treatment guides, and
                book with confidence. The most trusted resource for aesthetic
                medicine patients.
              </p>
              <h1 className="text-4xl font-medium leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[64px] lg:tracking-[-0.02em]">
                Find the{" "}
                <em className="font-heading font-normal italic">
                  Right Medspa
                </em>{" "}
                &amp; Treatment — Near You
              </h1>
            </div>

            {/* Search */}
            <HeroSearchBar className="max-w-[809px]" />

            {/* Trust indicators */}
            <ul className="flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold text-white">
              {trustItems.map((item) => (
                <li key={item} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-xl leading-none text-brand-green" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Social proof */}
          <div className="flex justify-end">
            <div className="flex items-end gap-4">
              <div className="flex items-center">
                {avatars.map((src, index) => (
                  <div
                    key={src}
                    className={cn(
                      "relative size-12 overflow-hidden rounded-full border-2 border-white/30 sm:size-14",
                      index > 0 && "-ml-3",
                    )}
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-4xl font-normal leading-none text-white sm:text-[52px]">
                  4.9
                </span>
                <div className="flex flex-col gap-1">
                  <StarRating rating={4.9} />
                  <span className="text-[15px] leading-tight text-white">
                    4500+ Happy Clients
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TreatmentCarousel />
    </section>
  );
}
