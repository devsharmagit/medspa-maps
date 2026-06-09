import { Search } from "lucide-react";

const steps = [
  {
    id: 1,
    icon: <Search className="h-6 w-6 text-white" />,
    title: "SEARCH",
    description: "Find treatments & clinic near you!",
    number: "1",
  },
  {
    id: 2,
    icon: <Search className="h-6 w-6 text-white" />,
    title: "COMPARE",
    description: "Compare prices reviews & results.",
    number: "2",
  },
  {
    id: 3,
    icon: <Search className="h-6 w-6 text-white" />,
    title: "BOOK",
    description: "Book your appointment online.",
    number: "3",
  },
  {
    id: 4,
    icon: <Search className="h-6 w-6 text-white" />,
    title: "ENJOY",
    description: "Love your results and feel confident.",
    number: "4",
  },
];

function StepCard({
  step,
  index,
}: {
  step: (typeof steps)[0];
  index: number;
}) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Card */}
      <div className="flex h-[157px] w-[172px] flex-col items-center justify-center gap-4 rounded-2xl border border-[#E8E8E8] bg-white px-4 py-6 shadow-sm">
        {/* Icon Circle */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C77BA8]">
          {step.icon}
        </div>

        {/* Title */}
        <h3 className="font-montserrat text-sm font-semibold uppercase tracking-[0.08em] text-[#8B6E7F]">
          {step.title}
        </h3>

        {/* Description */}
        <p className="text-center font-montserrat text-xs leading-[140%] text-[#8B8B8B]">
          {step.description}
        </p>
      </div>

      {/* Arrow and Number */}
      {index < steps.length - 1 && (
        <div className="absolute -right-8 top-1/2 flex -translate-y-1/2 items-center">
          {/* Arrow SVG */}
          <svg
            width="50"
            height="40"
            viewBox="0 0 50 40"
            fill="none"
            className="text-[#E8E8E8]"
          >
            <path
              d="M2 20H45M45 20L30 5M45 20L30 35"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.3"
            />
          </svg>
          {/* Step Number */}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-montserrat text-[80px] font-bold leading-none text-[#F5F5F5]">
            {step.number}
          </span>
        </div>
      )}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="flex w-full max-w-[1372px] items-center justify-center gap-8 rounded-2xl bg-[#FAF8FB] px-16 py-12">
      {/* Left Side - Title */}
      <div className="flex flex-col items-start">
        <h2 className="font-montserrat text-[42px] font-normal leading-[110%] text-[#8B6E7F]">
          How It
        </h2>
        <span className="font-heading text-[48px] italic leading-[110%] text-[#8B6E7F]">
          Works?
        </span>
      </div>

      {/* Right Side - Steps */}
      <div className="flex items-center gap-16">
        {steps.map((step, index) => (
          <StepCard key={step.id} step={step} index={index} />
        ))}
      </div>
    </section>
  );
}
