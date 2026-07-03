import Link from "next/link";
import { ChevronRight } from "lucide-react";
import React from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] sm:text-[14px] font-medium leading-[116%] mb-6">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={index}>
            {isLast ? (
              <span className="text-[#A8698A]/60">{item.label}</span>
            ) : (
              <>
                <Link href={item.href || "#"} className="text-[#A8698A] hover:opacity-80 transition-opacity">
                  {item.label}
                </Link>
                <ChevronRight className="size-3.5 text-[#A8698A]" />
              </>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
