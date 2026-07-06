import { HeroHeader } from "@/components/hero/hero-header";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/shared/breadcrumbs";

/**
 * Shared header for the /treatments, /conditions and /providers index pages.
 * Matches the detail-page theme: brand gradient behind the nav only, then a
 * left-aligned breadcrumb + title block on the light page background.
 */
export function ListingHero({
  crumbs,
  title,
  accent,
  subtitle,
  children,
}: {
  crumbs: BreadcrumbItem[];
  title: string;
  accent?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 pt-8 sm:px-6">
        <Breadcrumbs items={crumbs} />

        <div className="mb-8 max-w-3xl">
          <h1 className="font-montserrat text-[32px] font-medium leading-[108%] tracking-[-0.04em] text-[#373634] sm:text-[44px] lg:text-[52px]">
            {title}
            {accent ? (
              <>
                {" "}
                <span className="font-fraunces font-normal italic">{accent}</span>
              </>
            ) : null}
          </h1>
          {subtitle && (
            <p className="mt-4 max-w-2xl font-montserrat text-[15px] leading-relaxed text-zinc-600 sm:text-[18px]">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-6">{children}</div>}
        </div>
      </div>
    </>
  );
}
