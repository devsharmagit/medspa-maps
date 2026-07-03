import { cn } from "@/lib/utils";

const stats = [
  { value: "12,500+", label: "Verified Clinics" },
  { value: "750+", label: "Cities Covered" },
  { value: "48", label: "States Represented" },
  { value: "4.9", label: "Average Rating" },
  { value: "185,000+", label: "Monthly Visitors" },
];

export default function StatsSection() {
  return (
    <section className="w-full flex flex-col items-center justify-center py-12 lg:py-16 gap-8 lg:gap-[25px] px-4">
      {/* Heading */}
      <h2
        className="w-full text-center text-[30px] sm:text-[42px] lg:text-[56px] leading-[116.02%] tracking-[-0.04em] text-[#373634]"
        style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 400 }}
      >
        Trusted by Thousands. <span style={{fontFamily: "'Montserrat', sans-serif", color: "#CF5B9D", fontStyle: "normal"}}> Loved Everywhere. </span>
      </h2>

      {/* Stats — 2-col grid on mobile/tablet, single divider-separated row on desktop */}
      <div className="grid w-full max-w-md grid-cols-2 gap-x-6 gap-y-9 sm:max-w-xl lg:flex lg:max-w-none lg:flex-row lg:items-center lg:justify-center lg:gap-0">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(
              "flex flex-row items-center justify-center",
              index === stats.length - 1 && "max-lg:col-span-2",
            )}
          >
            {/* Stat block */}
            <div className="flex flex-col items-center w-full lg:w-[274px]">
              {/* Number */}
              <span
                className="w-full text-center text-[40px] sm:text-[48px] lg:text-[56px] text-[#373634] -mt-0.5 lg:h-[90px]"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontStyle: "normal" }}
              >
                {stat.value}
              </span>

              {/* Label */}
              <span
                className="w-full text-center text-[13px] sm:text-[15px] lg:text-[16px] leading-[116.02%] tracking-[0.1em] uppercase text-[#A8698B]"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
              >
                {stat.label}
              </span>
            </div>

            {/* Divider — desktop row only, after every stat except the last */}
            {index < stats.length - 1 && (
              <div
                className="hidden lg:block w-px h-[109px] flex-shrink-0"
                style={{ background: "rgba(193, 121, 165, 0.4)" }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
