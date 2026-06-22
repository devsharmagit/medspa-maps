"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, Star, MapPin } from "lucide-react";
import type { TreatmentListItem } from "@/lib/treatments/queries";

function TreatmentCard({ t }: { t: TreatmentListItem }) {
  return (
    <Link
      href={`/treatments/${t.slug}`}
      className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-zinc-900 group-hover:text-pink-700">
          {t.name}
        </h3>
        <ArrowRight className="size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-pink-500" />
      </div>

      {t.summary && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">
          {t.summary}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {t.price_from != null && (
          <span className="font-semibold text-zinc-900">
            From ${Number(t.price_from)}
            {t.price_unit ? (
              <span className="font-normal text-zinc-400">/{t.price_unit}</span>
            ) : null}
          </span>
        )}
        {t.hero_rating != null && (
          <span className="flex items-center gap-1 text-zinc-600">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {Number(t.hero_rating).toFixed(1)}
            {t.hero_review_count ? (
              <span className="text-zinc-400">({t.hero_review_count})</span>
            ) : null}
          </span>
        )}
        {t.clinic_count > 0 && (
          <span className="flex items-center gap-1 text-zinc-500">
            <MapPin className="size-3.5" />
            {t.clinic_count} {t.clinic_count === 1 ? "clinic" : "clinics"}
          </span>
        )}
      </div>
    </Link>
  );
}

export function TreatmentsGrid({ treatments }: { treatments: TreatmentListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return treatments;
    return treatments.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.summary ?? "").toLowerCase().includes(q)
    );
  }, [query, treatments]);

  const featured = filtered.filter((t) => t.has_content);
  const more = filtered.filter((t) => !t.has_content);

  return (
    <div>
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search treatments (e.g. Botox, filler, laser)…"
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
        />
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        {filtered.length} treatment{filtered.length === 1 ? "" : "s"}
        {query ? ` matching “${query}”` : " available"}
      </p>

      {featured.length > 0 && (
        <section className="mt-6">
          {!query && (
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              Featured Treatments
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((t) => (
              <TreatmentCard key={t.slug} t={t} />
            ))}
          </div>
        </section>
      )}

      {more.length > 0 && (
        <section className="mt-10">
          {!query && (
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              All Treatments
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((t) => (
              <TreatmentCard key={t.slug} t={t} />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
          No treatments match “{query}”.
        </div>
      )}
    </div>
  );
}
