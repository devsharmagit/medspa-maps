import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { LandingSection, LandingTable } from "@/lib/landing/types";
import { LandingImage } from "./image-placeholder";

/** "Label: rest of sentence" → bold the label. */
function Bullet({ text }: { text: string }) {
  const idx = text.indexOf(":");
  if (idx > 0 && idx < 42) {
    return (
      <>
        <strong className="font-semibold text-[#373634]">{text.slice(0, idx + 1)}</strong>
        {text.slice(idx + 1)}
      </>
    );
  }
  return <>{text}</>;
}

export function LandingHeading({
  heading,
  accent,
  className,
}: {
  heading: string;
  accent?: string;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "font-montserrat text-[27px] font-medium leading-[113%] tracking-[-0.03em] text-[#373634] sm:text-[34px]",
        className,
      )}
    >
      {heading}
      {accent ? (
        <>
          {" "}
          <span className="font-fraunces font-normal italic">{accent}</span>
        </>
      ) : null}
    </h2>
  );
}

function Body({ paragraphs }: { paragraphs?: string[] }) {
  if (!paragraphs?.length) return null;
  return (
    <div className="mt-5 space-y-4 text-[16.5px] leading-[1.75] text-zinc-700">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-5 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[16px] leading-[1.6] text-zinc-700">
          <Check className="mt-0.5 size-[18px] shrink-0 text-[#68bf52]" aria-hidden />
          <span>
            <Bullet text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Table({ table }: { table?: LandingTable }) {
  if (!table) return null;
  return (
    <div className="mt-6 overflow-x-auto rounded-[18px] border border-[#F0E2EC] bg-white shadow-[0px_6px_14px_rgba(170,78,179,0.06)]">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#F0E2EC] bg-[#faf5fa]">
            {table.headers.map((h) => (
              <th key={h} className="px-5 py-3.5 text-[13px] font-semibold text-[#7b2d6b]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-b border-[#F5EEF3] last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-5 py-3.5 text-[14.5px] text-zinc-600",
                    j === 0 && "font-semibold text-[#373634]",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PullQuote({ quote }: { quote?: string }) {
  if (!quote) return null;
  return (
    <blockquote className="mt-7 border-l-[3px] border-[#CF5B9D] pl-5 font-fraunces text-[20px] italic leading-[1.5] text-[#7b2d6b] sm:text-[23px]">
      {quote}
    </blockquote>
  );
}

function TextBlock({ section }: { section: LandingSection }) {
  return (
    <div>
      <LandingHeading heading={section.heading} accent={section.headingAccent} />
      <Body paragraphs={section.body} />
      <Bullets items={section.bullets} />
      <Table table={section.table} />
      <PullQuote quote={section.pullQuote} />
    </div>
  );
}

/**
 * One content section. With an image it lays out as an alternating image/text
 * row (`flip` puts the image on the left); without one it's a centered reading
 * column. Uses the full container width so the two columns are generous.
 */
export function FeatureSection({
  section,
  flip = false,
}: {
  section: LandingSection;
  flip?: boolean;
}) {
  if (!section.image) {
    return (
      <section id={section.id} className="mt-16 scroll-mt-28 sm:mt-20">
        <TextBlock section={section} />
      </section>
    );
  }

  return (
    <section id={section.id} className="mt-16 scroll-mt-28 sm:mt-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={cn("min-w-0", flip && "lg:order-2")}>
          <TextBlock section={section} />
        </div>
        <div className={cn(flip && "lg:order-1")}>
          <LandingImage
            slot={section.image}
            className="aspect-[4/3] w-full rounded-[26px] shadow-[0px_18px_44px_rgba(123,45,107,0.14)]"
            sizes="(max-width: 1024px) 100vw, 600px"
          />
        </div>
      </div>
    </section>
  );
}
