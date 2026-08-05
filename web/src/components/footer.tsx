import { ResourcesSection } from "@/components/hero/resources-section";
import { Newsletter } from "@/components/hero/newsletter";

export function Footer({
  showListingCta = false,
}: {
  /** "Get your med spa listed" banner — opt-in, home page only per marketing
   *  request. Defaults to false so any new page automatically excludes it
   *  unless explicitly opted in. */
  showListingCta?: boolean;
}) {
  return (
    <>
      <div className="relative z-10 mt-10 flex w-full flex-col items-center">
        {showListingCta && <ResourcesSection />}
        <div className="h-10 w-full lg:h-32" aria-hidden="true" />
        <Newsletter />
      </div>

      <footer className="relative z-0 flex w-full items-center justify-center bg-[#3D2E38] px-4 pb-[50px] pt-20 lg:pt-[187px]">
        <p className="text-center font-montserrat text-[14px] font-medium uppercase leading-[180%] tracking-[0.02em] text-[#C4C4C4]">
          Med Spa Maps © 2026. All rights reserved. Privacy Policy | Terms &amp; Condition
        </p>
      </footer>
    </>
  );
}
