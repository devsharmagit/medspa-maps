"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const footerCategories = [
  {
    title: "Top Los Angeles",
    links: [
      "Botox in Los Angeles",
      "Fillers in Los Angeles",
      "Laser Hair Removal",
      "Chemical Peels",
      "Microneedling",
    ],
  },
  {
    title: "Top Miami",
    links: [
      "Botox in Miami",
      "Fillers in Miami",
      "Laser Hair Removal",
      "Chemical Peels",
      "Microneedling",
    ],
  },
  {
    title: "Top New York",
    links: [
      "Botox in New York",
      "Fillers in New York",
      "Laser Hair Removal",
      "Chemical Peels",
      "Microneedling",
    ],
  },
  {
    title: "Top Dallas",
    links: [
      "Botox in Dallas",
      "Fillers in Dallas",
      "Laser Hair Removal",
      "Chemical Peels",
      "Microneedling",
    ],
  },
  {
    title: "Top Chicago",
    links: [
      "Botox in Chicago",
      "Fillers in Chicago",
      "Laser Hair Removal",
      "Chemical Peels",
      "Microneedling",
    ],
  },
  {
    title: "Top Illinois",
    links: [
      "Botox in Illinois",
      "Fillers in Illinois",
      "Laser Hair Removal",
      "Chemical Peels",
      "Microneedling",
    ],
  },
  {
    title: "Top Georgia",
    links: [
      "Botox in Georgia",
      "Fillers in Georgia",
      "Laser Hair Removal",
      "Chemical Peels",
      "Microneedling",
    ],
  },
];

function CategoryCard({ title, links }: { title: string; links: string[] }) {
  return (
    <div className="flex h-[63px] w-[184px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-transparent bg-gradient-to-br from-[#F9E9FC] to-[#EEBFD2] p-px shadow-[0_6px_10.5px_1px_rgba(0,0,0,0.05)]">
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3">
        {/* Title */}
        <h3 className="font-montserrat text-sm font-normal leading-tight text-[#373634]">
          {title}
        </h3>
        {/* Links */}
        <p className="text-center font-montserrat text-xs leading-tight text-[#616161]">
          {links[0]}
        </p>
      </div>
    </div>
  );
}

export function Footer() {
  const [topEmail, setTopEmail] = useState("");
  const [bottomEmail, setBottomEmail] = useState("");

  const handleTopSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Top subscription:", topEmail);
  };

  const handleBottomSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Bottom subscription:", bottomEmail);
  };

  return (
    <footer className="flex w-full flex-col items-center bg-[#FDFDFD]">
      {/* Newsletter CTA Section */}
      <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-r from-[#E8B4D9] via-[#D89FC8] to-[#E8B4A4] px-4 py-12">
        {/* Background Image */}
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-40">
          <Image
            src="/images/hero/Group.png"
            alt="Newsletter"
            fill
            className="object-cover object-left"
          />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left - Heading */}
          <div>
            <h2 className="font-montserrat text-[32px] font-normal leading-tight text-white lg:text-[36px]">
              Get <span className="font-heading italic">exclusive offer</span> &
              med spa tips
            </h2>
            <p className="mt-2 font-montserrat text-sm text-white/90">
              Join with thousand of subscribers!
            </p>
          </div>

          {/* Right - Form */}
          <form
            onSubmit={handleTopSubscribe}
            className="flex w-full max-w-md gap-2"
          >
            <input
              type="email"
              placeholder="Enter your email address"
              value={topEmail}
              onChange={(e) => setTopEmail(e.target.value)}
              className="flex-1 rounded-lg border-0 bg-white px-4 py-3 font-montserrat text-sm text-[#6B4A6B] placeholder-[#B8A8B8] focus:outline-none focus:ring-2 focus:ring-white/50"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] px-8 py-3 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>

      {/* Main Footer Section */}
      <div className="w-full bg-[#3D3D3D] px-4 py-12">
        <div className="mx-auto flex w-full max-w-[1395px] flex-col gap-12">
          {/* Categories Section */}
          <div className="flex w-full flex-col items-center gap-6">
            {/* Header with Navigation */}
            <div className="flex w-full items-center justify-between">
              {/* Left side - empty for spacing */}
              <div className="flex-1" />

              {/* Center - View All */}
              <Link
                href="#"
                className="flex items-center gap-2 transition-opacity hover:opacity-70"
              >
                <span className="font-montserrat text-base font-medium text-[#CF5D9A]">
                  View All
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="rotate-180"
                >
                  <path
                    d="M10 4L6 8L10 12"
                    stroke="#CF5D9A"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>

              {/* Right side - Navigation Arrows */}
              <div className="flex flex-1 items-center justify-end gap-2">
                {/* Left Arrow Button */}
                <button
                  className="relative flex h-[43px] w-[56px] items-center justify-center overflow-hidden rounded-l-full border border-white/40 bg-[#4D4D4D] transition-opacity hover:opacity-80"
                  aria-label="Previous categories"
                >
                  <ChevronLeft className="h-6 w-6 text-[#CF5D9A]/40" />
                </button>

                {/* Right Arrow Button */}
                <button
                  className="relative flex h-[43px] w-[56px] items-center justify-center overflow-hidden rounded-l-full border border-white/20 bg-[#4D4D4D] transition-opacity hover:opacity-80"
                  aria-label="Next categories"
                >
                  <ChevronRight className="h-6 w-6 text-[#CF5D9A]" />
                </button>
              </div>
            </div>

            {/* Category Cards Scrollable Container */}
            <div className="flex w-full gap-4 overflow-x-auto pb-2 scrollbar-none">
              {footerCategories.map((category, index) => (
                <CategoryCard
                  key={index}
                  title={category.title}
                  links={category.links}
                />
              ))}
            </div>
          </div>

          {/* Links and Newsletter Section */}
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
            {/* Left - Footer Links */}
            <div className="grid flex-1 grid-cols-2 gap-8 md:grid-cols-3">
              {/* Column 1 */}
              <div className="flex flex-col gap-3">
                <Link
                  href="#"
                  className="font-montserrat text-sm text-[#B8B8B8] transition-colors hover:text-white"
                >
                  FIND A MEDSPA
                </Link>
                <Link
                  href="#"
                  className="font-montserrat text-sm text-[#B8B8B8] transition-colors hover:text-white"
                >
                  TREATMENTS A-Z
                </Link>
                <Link
                  href="#"
                  className="font-montserrat text-sm text-[#B8B8B8] transition-colors hover:text-white"
                >
                  CONDITIONS
                </Link>
                <Link
                  href="#"
                  className="font-montserrat text-sm text-[#B8B8B8] transition-colors hover:text-white"
                >
                  BEST OF 2026
                </Link>
              </div>

              {/* Column 2 */}
              <div className="flex flex-col gap-3">
                <Link
                  href="#"
                  className="font-montserrat text-sm text-[#B8B8B8] transition-colors hover:text-white"
                >
                  GET A FREE LISTINGS
                </Link>
                <Link
                  href="#"
                  className="font-montserrat text-sm text-[#B8B8B8] transition-colors hover:text-white"
                >
                  I'M A G99 CLIENT
                </Link>
                <Link
                  href="#"
                  className="font-montserrat text-sm text-[#B8B8B8] transition-colors hover:text-white"
                >
                  FEATURED PLANS
                </Link>
                <Link
                  href="#"
                  className="font-montserrat text-sm text-[#B8B8B8] transition-colors hover:text-white"
                >
                  FOR PROVIDERS
                </Link>
              </div>
            </div>

            {/* Right - Newsletter Subscription */}
            <div className="flex w-full flex-col gap-4 lg:max-w-md">
              <p className="font-montserrat text-sm text-[#B8B8B8]">
                Subscribe to our newsletter and for important news and Updates
              </p>
              <form
                onSubmit={handleBottomSubscribe}
                className="flex gap-2"
              >
                <input
                  type="email"
                  placeholder="Enter Email Address"
                  value={bottomEmail}
                  onChange={(e) => setBottomEmail(e.target.value)}
                  className="flex-1 border-b border-[#6B6B6B] bg-transparent px-0 py-2 font-montserrat text-sm text-white placeholder-[#6B6B6B] focus:border-[#CF5D9A] focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="rounded-lg bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] px-6 py-2 font-montserrat text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  GO
                </button>
              </form>
            </div>
          </div>

          {/* Bottom - Copyright, Social, Legal */}
          <div className="flex flex-col gap-4 border-t border-[#5B5B5B] pt-8">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              {/* Left - Social Icons and Copyright */}
              <div className="flex items-center gap-4">
                {/* Social Icons */}
                <Link
                  href="#"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#CF5D9A] transition-opacity hover:opacity-80"
                  aria-label="Instagram"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </Link>
                <Link
                  href="#"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#CF5D9A] transition-opacity hover:opacity-80"
                  aria-label="Facebook"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                  </svg>
                </Link>

                {/* Copyright */}
                <p className="font-montserrat text-xs text-[#8B8B8B]">
                  MEDSPA MAPS © 2026. ALL RIGHTS RESERVED.
                </p>
              </div>

              {/* Right - Legal Links and Credit */}
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="#"
                  className="font-montserrat text-xs text-[#8B8B8B] transition-colors hover:text-white"
                >
                  PRIVACY POLICY
                </Link>
                <span className="text-[#8B8B8B]">|</span>
                <Link
                  href="#"
                  className="font-montserrat text-xs text-[#8B8B8B] transition-colors hover:text-white"
                >
                  TERMS & CONDITION
                </Link>
                <span className="text-[#8B8B8B]">|</span>
                <p className="flex items-center gap-2 font-montserrat text-xs text-[#8B8B8B]">
                  SITE DESIGNED & MAINTAINED BY:
                  <span className="font-semibold text-white">Growth99</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
