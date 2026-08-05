import Link from "next/link";

export interface ClinicConcern {
  name: string;
  slug: string;
}

function ConcernChip({ concern }: { concern: ClinicConcern }) {
  // Condition name only (which treatment solves it is deliberately not shown);
  // clicking finds every clinic that treats this condition.
  return (
    <Link
      href={`/search?condition=${encodeURIComponent(concern.slug)}`}
      className="inline-flex items-center rounded-full border border-[#F0DDE8] bg-white px-4 py-2 font-montserrat text-[13px] font-medium leading-none text-[#575757] shadow-[0px_2px_6px_rgba(0,0,0,0.03)] transition-colors hover:border-[#CF5B9D] hover:text-[#CF5B9D]"
    >
      {concern.name}
    </Link>
  );
}

/**
 * "Concerns We Treat" — patient conditions the clinic's own website explicitly
 * says it treats (evidence-based, never inferred from treatment names), with
 * the treatments its pages pair with each concern. Mirrors the treatments
 * chips section; hidden entirely when nothing is evidenced.
 */
export function ClinicConcernsSection({
  concerns,
  clinicName,
}: {
  concerns: ClinicConcern[];
  clinicName: string;
}) {
  if (!concerns.length) return null;

  return (
    <section id="concerns" className="flex w-full scroll-mt-28 flex-col items-center pt-[44px]">
      {/* Header */}
      <div className="mb-8 sm:mb-[38px] flex w-full max-w-[1342px] items-center gap-[16px] px-4">
        <h2 className="whitespace-nowrap font-montserrat text-[19px] sm:text-[34px] font-normal leading-[116.02%] tracking-[-0.04em] text-[#373634]">
          Concerns <span className="font-fraunces italic font-normal">Treated</span> By{" "}
          {clinicName}
        </h2>
        <div className="h-0 flex-1 border-t border-[rgba(193,121,165,0.4)]" />
      </div>

      {/* Chips */}
      <div className="flex w-full max-w-[1342px] flex-wrap items-center gap-[10px] px-4">
        {concerns.map((co) => (
          <ConcernChip key={co.slug} concern={co} />
        ))}
      </div>
    </section>
  );
}
