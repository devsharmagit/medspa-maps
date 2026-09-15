import Link from "next/link";
import { Trademark } from "@/lib/format/trademark";

export interface ClinicTreatment {
  name: string;
  slug: string | null;
  price_from: number | null;
  price_unit: string | null;
}

function TreatmentChip({ treatment }: { treatment: ClinicTreatment }) {
  // Clicking finds every clinic that offers this treatment (mirrors concern
  // chips). Links by SLUG: `?q=` is an exact slug lookup as of 2026-09-07, so
  // the display name would resolve to nothing. `slug` is null only for a row
  // whose catalog entry is gone, which the query already filters out — the
  // fallback renders the chip unlinked rather than pointing at a dead search.
  if (!treatment.slug) {
    return (
      <span className="inline-flex items-center rounded-full border border-[#F0DDE8] bg-white px-4 py-2 font-montserrat text-[13px] font-medium leading-none text-[#575757] shadow-[0px_2px_6px_rgba(0,0,0,0.03)]">
        <Trademark>{treatment.name}</Trademark>
        {treatment.price_from != null && (
          <span className="ml-1.5 text-[#A8698B]">· from ${treatment.price_from}</span>
        )}
      </span>
    );
  }
  return (
    <Link
      href={`/search?q=${encodeURIComponent(treatment.slug)}`}
      className="inline-flex items-center rounded-full border border-[#F0DDE8] bg-white px-4 py-2 font-montserrat text-[13px] font-medium leading-none text-[#575757] shadow-[0px_2px_6px_rgba(0,0,0,0.03)] transition-colors hover:border-[#CF5B9D] hover:text-[#CF5B9D]"
    >
      <Trademark>{treatment.name}</Trademark>
      {treatment.price_from != null && (
        <span className="ml-1.5 text-[#A8698B]">· from ${treatment.price_from}</span>
      )}
    </Link>
  );
}

export function ClinicTreatmentsCarousel({
  treatments,
  clinicName,
}: {
  treatments: ClinicTreatment[];
  clinicName: string;
}) {
  if (!treatments.length) return null;

  return (
    <section id="treatments" className="flex w-full scroll-mt-28 flex-col items-center pt-[44px]">
      {/* Header */}
      <div className="mb-8 sm:mb-[38px] flex w-full max-w-[1342px] items-center gap-[16px] px-4">
        <h2 className="whitespace-nowrap font-montserrat text-[19px] sm:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          Treatment{" "}
          <span className="font-fraunces italic font-normal">Offered</span> By{" "}
          {clinicName}
        </h2>
        <div className="h-0 flex-1 border-t border-[rgba(193,121,165,0.4)]" />
      </div>

      {/* Chips */}
      <div className="flex w-full max-w-[1342px] flex-wrap items-center gap-[10px] px-4">
        {treatments.map((t) => (
          <TreatmentChip key={t.slug ?? t.name} treatment={t} />
        ))}
      </div>
    </section>
  );
}
