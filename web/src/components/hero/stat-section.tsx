const stats = [
  { value: "12,500+", label: "Verified Clinics" },
  { value: "750+", label: "Cities Covered" },
  { value: "48", label: "States Represented" },
  { value: "4.9", label: "Average Rating" },
  { value: "185,000+", label: "Monthly Visitors" },
];

export default function StatsSection() {
  return (
    <section className="w-full flex flex-col items-center justify-center py-16 gap-[25px]">
      {/* Heading */}
      <h2
        className="w-full text-center text-[56px] leading-[116.02%] tracking-[-0.04em] text-[#373634]"
        style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 400 }}
      >
        Trusted by Thousands. <span style={{fontFamily: "'Montserrat', sans-serif", color: "#CF5B9D", fontStyle: "normal"}}> Loved Everywhere. </span> 
      </h2>

      {/* Stats row */}
      <div className="flex flex-row items-center justify-center w-full">
        {stats.map((stat, index) => (
          <div key={stat.label} className="flex flex-row items-center">
            {/* Stat block */}
            <div className="flex flex-col items-center w-[274px]">
              {/* Number */}
              <span
                className="w-full text-center text-[56px]  text-[#373634] -mt-0.5 h-[90px]"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontStyle: "normal" }}
              >
                {stat.value}
              </span>

              {/* Label */}
              <span
                className="w-full text-center text-[16px] leading-[116.02%] tracking-[0.1em] uppercase text-[#A8698B]"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
              >
                {stat.label}
              </span>
            </div>

            {/* Divider — render after every stat except the last */}
            {index < stats.length - 1 && (
              <div
                className="w-px h-[109px] flex-shrink-0"
                style={{ background: "rgba(193, 121, 165, 0.4)" }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}