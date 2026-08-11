"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// A single expandable FAQ. Animates open/close by transitioning the panel's
// height between 0 and the measured content height, then settling to `auto`
// so the layout stays responsive after the animation.

export function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState<number | "auto">(0);
  const contentRef = useRef<HTMLDivElement>(null);

  function toggle() {
    const el = contentRef.current;
    if (!el) return;

    if (open) {
      // Closing: pin the current pixel height, then animate to 0.
      setHeight(el.scrollHeight);
      requestAnimationFrame(() => setHeight(0));
      setOpen(false);
    } else {
      // Opening: animate from 0 to the measured content height.
      setHeight(el.scrollHeight);
      setOpen(true);
    }
  }

  return (
    <div
      data-open={open}
      className="rounded-[18px] border border-[#DEC6DF] bg-white/70 shadow-[0px_8px_14px_rgba(0,0,0,0.02)] transition-colors data-[open=true]:bg-white"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <h3 className="font-montserrat text-[17px] sm:text-[19px] font-semibold leading-[130%] tracking-[-0.02em] text-[#373634]">
          {question}
        </h3>
        <ChevronDown
          className={`size-5 shrink-0 text-[#CF5D9A] transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {/* Animated panel */}
      <div
        className="overflow-hidden transition-[height] duration-300 ease-out"
        style={{ height }}
        onTransitionEnd={() => {
          // Settle to auto once open so long answers reflow on resize.
          if (open) setHeight("auto");
        }}
      >
        <div ref={contentRef}>
          <p className="px-6 pb-5 font-montserrat text-[15px] sm:text-[16px] leading-[160%] text-[#575757]">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}
