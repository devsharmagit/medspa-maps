"use client";

import { useEffect, useState } from "react";

import type { TocItem } from "@/lib/blog/toc";
import { cn } from "@/lib/utils";

/**
 * Sidebar "On this page" index. Renders the article's H2/H3 headings as
 * anchor links, smooth-scrolls to a section on click, and highlights the
 * section currently in view. Headings carry matching ids (see markdown.tsx).
 */
export function TableOfContents({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (items.length === 0) return;

    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el != null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // Trigger a bit below the sticky header, and treat the top ~third of the
      // viewport as the "active" zone.
      { rootMargin: "-120px 0px -66% 0px", threshold: 0 },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  const handleClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  };

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="On this page"
      className="hidden rounded-[18px] border border-[#F0E2EC] bg-white p-5 shadow-[0px_8px_14px_rgba(0,0,0,0.02)] lg:block"
    >
      <h2 className="font-montserrat text-[13px] font-semibold uppercase tracking-[0.1em] text-[#AC467B]">
        On this page
      </h2>

      <ul className="mt-3 space-y-0.5">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                className={cn(
                  "flex gap-2 py-1 font-montserrat text-[13px] leading-[1.4] transition-colors",
                  item.level === 3 && "pl-4",
                  isActive
                    ? "font-medium text-[#CF5B9D]"
                    : "text-[#6b6b6b] hover:text-[#373634]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-[6px] size-[6px] shrink-0 rounded-full",
                    item.level === 3
                      ? cn("border", isActive ? "border-[#CF5B9D]" : "border-[#d3a9cb]")
                      : isActive
                        ? "bg-[#CF5B9D]"
                        : "bg-[#CF5B9D]/60",
                  )}
                />
                <span>{item.text}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
