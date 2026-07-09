"use client";

import { useState } from "react";

export interface ClinicTreatment {
  name: string;
  slug: string | null;
  price_from: number | null;
  price_unit: string | null;
}

// How many chips show before the "View More" toggle appears.
const VISIBLE_COUNT = 10;

function TreatmentChip({ treatment }: { treatment: ClinicTreatment }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#F0DDE8] bg-white px-4 py-2 font-montserrat text-[13px] font-medium leading-none text-[#575757] shadow-[0px_2px_6px_rgba(0,0,0,0.03)]">
      {treatment.name}
      {treatment.price_from != null && (
        <span className="ml-1.5 text-[#A8698B]">· from ${treatment.price_from}</span>
      )}
    </span>
  );
}

export function ClinicTreatmentsCarousel({
  treatments,
  clinicName,
}: {
  treatments: ClinicTreatment[];
  clinicName: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!treatments.length) return null;

  const visible = expanded ? treatments : treatments.slice(0, VISIBLE_COUNT);
  const hiddenCount = treatments.length - VISIBLE_COUNT;

  return (
    <section className="flex w-full flex-col items-center pt-[44px]">
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
        {visible.map((t) => (
          <TreatmentChip key={t.slug ?? t.name} treatment={t} />
        ))}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center rounded-full border border-dashed border-[#CF5B9D] px-4 py-2 font-montserrat text-[13px] font-semibold text-[#CF5B9D] transition-colors hover:bg-pink-50"
          >
            {expanded ? "Show less" : `+${hiddenCount} more · View More`}
          </button>
        )}
      </div>
    </section>
  );
}
