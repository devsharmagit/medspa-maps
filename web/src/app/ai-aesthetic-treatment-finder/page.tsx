import Image from "next/image";
import { Footer } from "@/components/footer";
import { HeroHeader } from "@/components/hero/hero-header";
import { SkinNavigatorClient } from "./skin-navigator-client";

export const dynamic = "force-dynamic";

export default function SkinNavigatorPage() {
  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-x-clip bg-[#fbfbfb]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[690px] overflow-hidden bg-[#2f1832] sm:h-[560px]" aria-hidden>
        <div className="absolute inset-0 bg-hero-gradient opacity-95" />
        <Image
          src="/images/hero/bg-overlay-1.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center opacity-20 mix-blend-multiply"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/35" />
      </div>
      <HeroHeader />
      <SkinNavigatorClient />
      <Footer />
    </main>
  );
}
