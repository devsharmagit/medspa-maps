import Image from "next/image";
import Link from "next/link";

import { TOP_STATES } from "@/data/top-states";
import { formatCountPlus } from "@/lib/utils";

export function TopCities() {
  return (
    <section className="mx-auto flex w-full max-w-[1372px] flex-col gap-5 py-6 px-4 min-[1400px]:px-0">
      {/* Header Row */}
      <div className="flex w-full items-end justify-between">
        <div>
          <p className="font-montserrat text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-magenta">
            Explore by
          </p>
          <h2 className="font-montserrat font-normal text-[#373634] text-[28px] sm:text-[34px] tracking-[-0.04em] leading-[116.02%]">
            Top <span className="font-heading italic">States</span>
          </h2>
        </div>
      </div>

      {/* States Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-6">
        {TOP_STATES.map((state) => (
          <Link
            key={state.abbr}
            href={`/search?location=${state.abbr}`}
            className="group relative block aspect-[4/3.4] overflow-hidden rounded-2xl shadow-sm transition-shadow hover:shadow-[0_10px_28px_rgba(170,78,179,0.18)] sm:aspect-[4/3]"
          >
            <Image
              src={state.image}
              alt={`${state.state} med spas`}
              fill
              sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 45vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="font-montserrat text-[15px] font-semibold leading-tight text-white sm:text-[17px]">
                {state.state}
              </p>
              <p className="font-montserrat text-[12px] text-white/80 sm:text-[13px]">
                {formatCountPlus(state.clinicCount)} med spas
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
