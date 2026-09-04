import { Footer } from "@/components/footer";
import { ListingHero } from "@/components/shared/listing-hero";

const BODY = "max-w-[820px]";

/**
 * Shared shell + typography for the long-form legal pages (/privacy-policy,
 * /terms). There is no Tailwind Typography plugin in this project, so the
 * heading/paragraph scale is defined once here rather than repeated in each
 * document.
 */
export function LegalPage({
  title,
  accent,
  lastUpdated,
  children,
}: {
  title: string;
  accent?: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950">
      <ListingHero
        crumbs={[{ label: "Home", href: "/" }, { label: accent ? `${title} ${accent}` : title }]}
        title={title}
        accent={accent}
        contentClassName={BODY}
      />

      <div className={`mx-auto w-full ${BODY} px-4 pb-16 sm:px-6`}>
        <p className="font-montserrat text-[14px] font-medium uppercase tracking-[0.02em] text-zinc-500">
          Last Updated: {lastUpdated}
        </p>
        <div className="mt-8">{children}</div>
      </div>

      <Footer />
    </main>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 font-montserrat text-[22px] font-medium leading-[130%] tracking-[-0.02em] text-[#373634] sm:text-[26px]">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-7 font-montserrat text-[17px] font-semibold leading-[140%] text-[#373634] sm:text-[19px]">
      {children}
    </h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 font-montserrat text-[15px] leading-[180%] text-zinc-700 sm:text-[16px]">
      {children}
    </p>
  );
}

export function UL({ items }: { items: string[] }) {
  return (
    <ul className="mb-4 list-disc space-y-2 pl-6 font-montserrat text-[15px] leading-[180%] text-zinc-700 sm:text-[16px]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
