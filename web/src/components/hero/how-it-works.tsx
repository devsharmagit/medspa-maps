import { Search } from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const steps = [
  {
    id: 1,
    title: "SEARCH",
    description: "Find treatments & clinics near you!",
    number: "1",
    svg: "/images/landingpage/1.svg",
    leftOffset: -15,
  },
  {
    id: 2,
    title: "COMPARE",
    description: "Compare reviews & results.",
    number: "2",
    svg: "/images/landingpage/2.svg",
    leftOffset: -24.25,
  },
  {
    id: 3,
    title: "BOOK",
    description: "Book an appointment on their website.",
    number: "3",
    svg: "/images/landingpage/3.svg",
    leftOffset: -10.5,
  },
  {
    id: 4,
    title: "ENJOY",
    description: "Love your results and feel confident.",
    number: "4",
    svg: "/images/landingpage/4.svg",
    leftOffset: -17.75,
  },
];

// ─── HowItWorks ───────────────────────────────────────────────────────────────

export function HowItWorks() {
  return (
    // Outer container: 1372×330px on desktop, gradient, pink border, subtle shadow
    <section
      className="flex w-[calc(100%-2rem)] max-w-[1372px] flex-col min-[1400px]:flex-row items-center justify-center rounded-[18px] border border-[#DEC6DF] py-10 px-6 min-[1400px]:py-[14px] min-[1400px]:pr-[34px] min-[1400px]:pl-0 min-[1400px]:pb-[5px]"
      style={{
        background: "linear-gradient(129.28deg, #FCD1FF -95.16%, #FFFFFF 21.93%)",
        boxShadow: "0px 8px 14px rgba(0,0,0,0.02)",
        minHeight: 330,
        gap: 1,
      }}
    >
      {/* ── Left title block ── */}
      {/* Width 317px on desktop: padding 0 59px 0 62px → title is 216px wide */}
      <div
        className="flex shrink-0 items-start justify-center mb-10 min-[1400px]:mb-0 w-full min-[1400px]:w-[317px] px-4 min-[1400px]:px-0 min-[1400px]:pl-[62px] min-[1400px]:pr-[59px]"
      >
        <h2
          className="font-montserrat font-medium leading-[116.02%] tracking-[-0.04em] text-[#99597A] text-center min-[1400px]:text-left text-4xl lg:text-[58px]"
          style={{ lineHeight: "116.02%" }}
        >
          How It{" "}
          <span className="font-heading italic">Works?</span>
        </h2>
      </div>

      {/* ── Steps area: 994×206px on desktop, relative for absolute numbers ── */}
      <div
        className="relative grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 justify-items-center gap-14 xl:gap-[27px] w-full xl:w-[994px]"
        style={{ isolation: "isolate" }}
      >
        {/* ── Step cards ── */}
        {steps.map((step, idx) => (
          // Each card wrapper: 228.25×206px, relative positioning anchor
          <div
            key={step.id}
            className="relative flex shrink-0"
            style={{
              width: 228.25,
              height: 206,
              zIndex: 2 + idx * 2, // stack layers correctly
            }}
          >
            {/* Watermark Number SVG (relative to card bottom-left) */}
            <div
              className="pointer-events-none absolute select-none flex items-center justify-center"
              style={{
                top: 150,
                left: step.leftOffset,
                zIndex: 1, // behind card body
              }}
            >
              <img
                src={step.svg}
                alt={step.number}
                className="select-none pointer-events-none object-contain"
                style={{
                  height: 73,
                  width: "auto",
                }}
              />
            </div>

            {/* Card Body */}
            <div
              className="relative flex h-full w-full flex-col items-center justify-center rounded-[22px] border border-[#E9CCEC]"
              style={{
                background: "rgba(255,255,255,0.7)",
                padding: "19px 26px 0px",
                gap: 14,
                zIndex: 2, // in front of watermark number
              }}
            >
              {/* Pink circle icon — floats above top edge */}
              <div
                className="absolute flex items-center justify-center rounded-full bg-[#CF5D9A]"
                style={{
                  width: 50,
                  height: 49,
                  top: -21.5,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 10,
                  padding: 3,
                }}
              >
                <Search className="h-[18px] w-[18px] text-white" strokeWidth={1.5} />
              </div>

              {/* Title */}
              <h3
                className="w-full text-center font-montserrat font-semibold uppercase text-[#A8698B]"
                style={{
                  fontSize: 20,
                  lineHeight: "116.02%",
                  letterSpacing: "0.29em",
                }}
              >
                {step.title}
              </h3>

              {/* Description */}
              <p
                className="text-center font-montserrat text-[#575757]"
                style={{ fontSize: 18, lineHeight: "140%" }}
              >
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
