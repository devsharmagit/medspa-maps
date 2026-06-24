import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, CalendarDays, Star } from "lucide-react";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { getConcernData } from "@/lib/concerns/queries";
import { ConcernTabs } from "./concern-tabs";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getConcernData(slug);
  if (!data) return { title: "Concern not found" };
  return {
    title: data.concern.meta_title ?? `${data.concern.name} — Medspa Map`,
    description:
      data.concern.meta_description ?? data.concern.overview ?? undefined,
  };
}

export default async function ConditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getConcernData(slug);
  if (!data) notFound();

  const { concern, beforeAfter, reviews } = data;

  return (
    <main className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950">
      {/* Banner + nav */}
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-800">
            Home
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-zinc-700">Concerns</span>
        </nav>

        {/* Title row */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            {concern.name}
          </h1>
          <a
            href="#clinics"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#e08a4f] to-[#d96f8e] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Book Appointment <CalendarDays className="size-4" />
          </a>
        </div>

        {/* Tabs + overview + clinics */}
        <div className="mt-7">
          <ConcernTabs data={data} />
        </div>

        {/* Before & After */}
        {beforeAfter.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Before &amp; After Results
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {beforeAfter.map((img, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.cdn_url || img.source_url}
                    alt={img.alt_text || `${concern.name} before and after`}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              What Our Clients Say
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  {r.rating != null && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className={`size-4 ${
                            s < r.rating!
                              ? "fill-amber-400 text-amber-400"
                              : "text-zinc-200"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                    “{r.body}”
                  </p>
                  <div className="mt-4 text-sm font-medium text-zinc-800">
                    — {r.reviewer_name || "Verified Patient"}
                    <span className="ml-1 font-normal text-zinc-400">
                      · {r.clinic_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Footer />
    </main>
  );
}
