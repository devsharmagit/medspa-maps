"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Treatments", href: "/treatments", hasDropdown: true },
  { label: "Clinics", href: "/providers" },
  { label: "Before & After", href: "#" },
  { label: "Best of 2026", href: "#" },
  { label: "Reviews", href: "#" },
  { label: "Resources", href: "#", hasDropdown: true },
] as const;

const scrollToListYourMedspa = () => {
  const element = document.getElementById("list-your-medspa");
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

export function HeroHeader({ className }: { className?: string }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Spacer to maintain layout flow since header is fixed */}
      <div className="h-[94px] w-full shrink-0" aria-hidden="true" />
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-[100] w-full transition-colors duration-300",
          isScrolled 
            ? "bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f] shadow-md" 
            : "bg-transparent",
          className,
        )}
      >
        {/* Dark overlay that is always present to keep the shade consistent */}
        <div className="absolute inset-0 pointer-events-none -z-10 bg-gradient-to-r from-transparent to-black/60" />
      <div className="mx-auto flex h-[94px] max-w-[1338px] items-center justify-between px-4 sm:px-6 lg:px-[18px]">
        <Link
          href="/"
          className="relative block w-[103px] h-[65px]  shrink-0"
        >
          <Image
            src="/images/hero/logo.png"
            alt="Medspa Map"
            width={103}
            height={65}
            className="h-full w-auto max-w-none object-contain object-left"
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
              {"hasDropdown" in link && link.hasDropdown && (
                <ChevronDown className="size-3.5 rotate-[-90deg]" aria-hidden />
              )}
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
        </div>
      </div>
    </header>
    </>
  );
}
