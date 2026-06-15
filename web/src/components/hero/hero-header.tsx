import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

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

export function HeroHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "relative z-10 w-full bg-gradient-to-r from-transparent to-black/60",
        className,
      )}
    >
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
            className="hidden h-auto rounded-lg border-[#c8c8c8] bg-transparent px-6 py-2.5 text-sm font-semibold text-white shadow-none hover:bg-white/10 hover:text-white sm:inline-flex"
            asChild
          >
            <Link href="#">List Your Medspa</Link>
          </Button>
          <Button
          variant={"gradient"}
            className="h-auto rounded-lg border-0  px-6 py-2.5 text-sm font-semibold text-white shadow-none hover:opacity-90"
            asChild
          >
            <Link href="#">Login / Signup</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
