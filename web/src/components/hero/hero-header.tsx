"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { scrollToListYourMedspa } from "@/lib/scroll-to-list-your-medspa";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Find My Treatment", href: "/skin-navigator" },
  { label: "Clinics", href: "/search" },
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
            alt="MedSpa Maps"
            width={380}
            height={120}
            className="h-[52px] w-auto object-contain"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-7 xl:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center gap-1.5 text-base font-medium text-white transition-opacity hover:opacity-80"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-[9px]">
          <Button
            variant="outline"
            onClick={scrollToListYourMedspa}
            className="hidden h-auto rounded-lg border-[#c8c8c8] bg-transparent px-6 py-2.5 text-sm font-semibold text-white shadow-none hover:bg-white/10 hover:text-white sm:inline-flex cursor-pointer"
          >
            List Your Medspa
          </Button>

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
          menuOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="border-t border-white/15 bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f] px-4 pb-6 pt-2 sm:px-6">
          <nav className="flex flex-col" aria-label="Mobile">
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
          <Button
            variant="outline"
            onClick={() => {
              setMenuOpen(false);
              scrollToListYourMedspa();
            }}
            className="mt-5 h-auto w-full rounded-lg border-white/50 bg-white/10 px-6 py-3 text-sm font-semibold text-white shadow-none hover:bg-white/20 hover:text-white cursor-pointer"
          >
            List Your Medspa
          </Button>
        </div>
      </div>
    </header>
    </>
  );
}
