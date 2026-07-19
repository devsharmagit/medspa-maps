"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, MapPin, ArrowRight } from "lucide-react";
import type { TreatmentListItem } from "@/lib/treatments/queries";
import { treatmentImage } from "@/lib/images/catalog-images";

function TreatmentCard({ t, index }: { t: TreatmentListItem; index: number }) {
  return (
    <Link
      href={`/search?q=${t.slug}`}
      className="group flex flex-col overflow-hidden rounded-[18px] border border-[#F0E2EC] bg-white shadow-[0px_6px_14px_rgba(170,78,179,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-[#E3CED8] hover:shadow-[0px_16px_34px_rgba(170,78,179,0.14)]"
    >
      <div className="relative h-[200px] w-full overflow-hidden bg-[linear-gradient(144.23deg,#F5F0F7_-33.1%,#FFFFFF_48.72%)]">
        <Image
          src={treatmentImage(t.slug)}
          alt={t.name}
          fill
          priority={index < 4}
          className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        {t.clinic_count > 0 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-[#7b2d6b] shadow-sm backdrop-blur-sm">
            <MapPin className="size-3.5 text-[#CF5D9A]" />
            {t.clinic_count} {t.clinic_count === 1 ? "clinic" : "clinics"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-6 py-5">
        <h3 className="mb-2 text-[19px] font-semibold tracking-[-0.01em] text-[#373634] transition-colors group-hover:text-[#9b3a6e]">
          {t.name}
        </h3>
        <div className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#CF5B9D]">
          Find Clinics
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

export function TreatmentsGrid({ treatments }: { treatments: TreatmentListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return treatments;
    return treatments.filter((t) => t.name.toLowerCase().includes(q));
  }, [query, treatments]);

  return (
    <div>
      {/* Search / count card — overlaps the hero */}
      <div className="mb-10 flex flex-col gap-4 rounded-[20px] border border-[#F0E2EC] bg-white p-5 shadow-[0px_10px_30px_rgba(123,45,107,0.10)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="font-montserrat text-sm font-medium text-zinc-500">
          <span className="font-semibold text-[#7b2d6b]">{filtered.length}</span>{" "}
          treatment{filtered.length === 1 ? "" : "s"}
          {query ? ` matching “${query}”` : " available"}
        </p>
        <div className="relative w-full sm:max-w-[340px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search treatments..."
            className="w-full rounded-[10px] border border-[#D2C3D3] bg-white py-2.5 pl-10 pr-4 text-[14px] text-zinc-900 outline-none transition focus:border-[#CF5D9A] focus:ring-2 focus:ring-[#CF5D9A]/20"
          />
        </div>
      </div>

      {filtered.length > 0 && (
        <section className="mb-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((t, idx) => (
              <TreatmentCard key={t.slug} t={t} index={idx} />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="mt-10 rounded-[16px] border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
          No treatments match “{query}”.
        </div>
      )}
    </div>
  );
}
