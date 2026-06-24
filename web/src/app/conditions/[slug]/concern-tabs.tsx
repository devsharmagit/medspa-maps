"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, BadgeCheck } from "lucide-react";
import type { ConcernPageData } from "@/lib/concerns/queries";

const TABS = ["Overview", "Clinics & Diagnosis", "Doctors & Providers"] as const;
type Tab = (typeof TABS)[number];

// Card layout mirrors the concern-page design: a left column of stacked
// labelled paragraphs and a right grid of detail cards.
const LEFT_FIELDS: { key: string; label: string }[] = [
  { key: "signs", label: "Signs" },
  { key: "causes", label: "Causes" },
  { key: "candidate", label: "Who Is a Candidate?" },
  { key: "results", label: "Expected Results" },
];
const CARD_FIELDS: { key: string; label: string }[] = [
  { key: "treatment_areas", label: "Common Treatment Areas" },
  { key: "injectables", label: "Injectable Treatments" },
  { key: "benefits", label: "Benefits" },
  { key: "prevention", label: "Preventative Care" },
];

export function ConcernTabs({ data }: { data: ConcernPageData }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const { concern, services, clinics } = data;
  const details = concern.details ?? {};

  return (
    <div>
      {/* Tab bar */}
      <div className="flex flex-wrap gap-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition ${
              tab === t
                ? "bg-purple-100 text-purple-900 shadow-sm"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "Overview" && (
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-9 shadow-sm">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              What is {concern.name}?
            </h2>
            {concern.overview && (
              <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-zinc-600">
                {concern.overview}
              </p>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              {/* left stacked fields */}
              <div className="space-y-6">
                {LEFT_FIELDS.filter((f) => details[f.key]).map((f) => (
                  <div key={f.key}>
                    <div className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
                      <ArrowRight className="size-4 text-pink-500" />
                      {f.label}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                      {details[f.key]}
                    </p>
                  </div>
                ))}
              </div>

              {/* right card grid */}
              <div className="grid gap-5 sm:grid-cols-2">
                {CARD_FIELDS.filter((f) => details[f.key]).map((f) => (
                  <div
                    key={f.key}
                    className="rounded-2xl border border-zinc-200 p-5 transition hover:shadow-sm"
                  >
                    <h3 className="text-[15px] font-semibold text-zinc-900">
                      {f.label}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                      {details[f.key]}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {services.length > 0 && (
              <div className="mt-9 border-t border-zinc-100 pt-6">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Treatments for {concern.name}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {services.map((s) => (
                    <Link
                      key={s.id}
                      href={`/treatments/${s.slug}`}
                      className="rounded-full bg-pink-50 px-3.5 py-1.5 text-sm font-medium text-pink-700 ring-1 ring-pink-100 transition hover:bg-pink-100"
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "Clinics & Diagnosis" && (
          <section>
            {clinics.length === 0 ? (
              <Empty label="No clinics offering these treatments yet." />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {clinics.map((c) => (
                  <div
                    key={c.id}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                  >
                    <div className="h-36 w-full bg-zinc-100">
                      {c.cover_image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.cover_image}
                          alt={c.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate font-semibold text-zinc-900">
                          {c.name}
                        </h3>
                        {c.verified && (
                          <BadgeCheck className="size-4 shrink-0 text-pink-500" />
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
                        <MapPin className="size-3.5" />
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </div>
                      <div className="mt-2 text-sm text-zinc-600">
                        {c.avg_rating
                          ? `★ ${Number(c.avg_rating).toFixed(1)} (${c.review_count})`
                          : "No reviews yet"}
                      </div>
                      {(c.booking_url || c.website) && (
                        <a
                          href={c.booking_url || c.website || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-pink-600 hover:text-pink-700"
                        >
                          View Clinic <ArrowRight className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "Doctors & Providers" && (
          <Empty label="Provider profiles for this concern are coming soon." />
        )}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
      {label}
    </div>
  );
}
