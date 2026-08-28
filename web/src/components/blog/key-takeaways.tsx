import { Check } from "lucide-react";

/** TL;DR "Key Takeaways" callout box shown at the top of an article. */
export function KeyTakeaways({ items }: { items: string[] }) {
  return (
    <section
      aria-label="Key takeaways"
      className="mt-2 rounded-[16px] border border-[#DEC6DF] p-5 sm:p-6"
      style={{
        background: "linear-gradient(210.9deg, #FCD1FF -132.87%, #FFFFFF 43.51%)",
        boxShadow: "0px 8px 14px rgba(0, 0, 0, 0.02)",
      }}
    >
      <p className="font-montserrat text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-magenta">
        TL;DR — Key takeaways
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E2CCE2]">
              <Check className="size-3 text-[#7b2d6b]" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="font-montserrat text-[14px] leading-[1.6] text-[#3d3140] sm:text-[15px]">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
