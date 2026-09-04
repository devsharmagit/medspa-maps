"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import {
  FAV_CONDITIONS,
  FAV_TREATMENTS,
  PATIENTS_FAV_HREF,
  type NavItem,
} from "@/lib/landing/nav";

const navLinks = [
  { label: "Find My Treatment", href: "/ai-aesthetic-treatment-finder" },
  { label: "Explore Practices", href: "/search" },
] as const;

export function HeroHeader({ className }: { className?: string }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <>
      {/* Spacer to maintain layout flow since header is fixed */}
      <div className="h-[94px] w-full shrink-0" aria-hidden="true" />
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-[100] w-full transition-colors duration-300",
          isScrolled || menuOpen
            ? "bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f] shadow-md"
            : "bg-transparent",
          className,
        )}
      >
        {/* Dark overlay that is always present to keep the shade consistent */}
        <div className="absolute inset-0 pointer-events-none -z-10 bg-gradient-to-r from-transparent to-black/60" />
      <div className="mx-auto flex h-[94px] max-w-[1338px] items-center justify-between px-4 sm:px-6 lg:px-[18px]">
        <Link href="/" className="block shrink-0">
          <Image
            src="/images/hero/logo.svg"
            alt="Medspa Maps"
            width={380}
            height={120}
            className="h-[52px] w-auto object-contain"
            priority
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-[9px]">
          <nav className="hidden items-center gap-8 xl:flex" aria-label="Main">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="flex items-center gap-1.5 text-base font-medium text-white transition-opacity hover:opacity-80"
              >
                {link.label}
              </Link>
            ))}

            {/* Patients' Favourites — pinned far right: link to the favourites page + a hover dropdown */}
            <div className="group relative">
              <Link
                href={PATIENTS_FAV_HREF}
                className="flex items-center gap-1.5 text-base font-medium text-white transition-opacity hover:opacity-80"
              >
                Patients&apos; Favourites
                <ChevronDown
                  className="size-4 transition-transform duration-200 group-hover:rotate-180"
                  aria-hidden
                />
              </Link>

              {/* Dropdown panel — right-aligned so it stays on-screen at the far right (pt-3 bridges the hover gap) */}
              <div className="invisible absolute right-0 top-full z-50 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                <div className="w-[480px] rounded-2xl border border-[#F0E2EC] bg-white p-5 shadow-[0_24px_60px_rgba(123,45,107,0.20)]">
                  <div className="grid grid-cols-2 gap-x-6">
                    <DropdownColumn title="Treatments" items={FAV_TREATMENTS} />
                    <DropdownColumn title="Conditions" items={FAV_CONDITIONS} />
                  </div>
                  <Link
                    href={PATIENTS_FAV_HREF}
                    className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#DE7F4C_0%,#C341D7_100%)] px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    View all patients&apos; favourites
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </nav>

          {/* Mobile menu toggle — nav collapses below xl */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="inline-flex size-10 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 xl:hidden cursor-pointer"
          >
            {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {/* ── Mobile menu panel ── */}
      <div
        id="mobile-menu"
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out xl:hidden",
          menuOpen ? "max-h-[760px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="border-t border-white/15 bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f] px-4 pb-6 pt-2 sm:px-6">
          <nav className="flex flex-col" aria-label="Mobile">
            {/* Patients' Favourites */}
            <Link
              href={PATIENTS_FAV_HREF}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between border-b border-white/10 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-80"
            >
              Patients&apos; Favourites
            </Link>
            <div className="grid grid-cols-2 gap-x-4 border-b border-white/10 py-3">
              <MobileFavGroup title="Treatments" items={FAV_TREATMENTS} onNavigate={() => setMenuOpen(false)} />
              <MobileFavGroup title="Conditions" items={FAV_CONDITIONS} onNavigate={() => setMenuOpen(false)} />
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between border-b border-white/10 py-3.5 text-base font-medium text-white transition-opacity hover:opacity-80"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
    </>
  );
}

function DropdownColumn({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className={title === "Conditions" ? "border-l border-[#F3E7EF] pl-6" : ""}>
      <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#CF5B9D]">
        {title}
      </p>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="block rounded-lg px-2 py-2 text-[14px] font-medium text-[#373634] transition-colors hover:bg-[#FCEFF6] hover:text-[#9b3a6e]"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function MobileFavGroup({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  onNavigate: () => void;
}) {
  return (
    <div>
      <p className="px-1 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
        {title}
      </p>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className="block px-1 py-1.5 text-[14px] font-medium text-white/90 transition-opacity hover:opacity-80"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
