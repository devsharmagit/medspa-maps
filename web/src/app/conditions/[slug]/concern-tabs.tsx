"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ConcernPageData } from "@/lib/concerns/queries";
import { ClinicsCarousel } from "@/components/shared/clinics-carousel";
import { ProvidersCarousel } from "@/components/shared/providers-carousel";

const TABS = ["Overview", "Clinics & Diagnosis", "Doctors & Providers"] as const;
type Tab = (typeof TABS)[number];

const LEFT_FIELDS: { key: string; label: string }[] = [
  { key: "signs", label: "Signs of Aging" },
  { key: "causes", label: "Causes" },
  { key: "candidate", label: "Who Is a Candidate?" },
  { key: "results", label: "Expected Results" },
];

const CARD_FIELDS: { key: string; label: string }[] = [
  { key: "treatment_areas", label: "Common Treatment Areas" },
  { key: "injectables", label: "Injectable Treatments" },
  { key: "benefits", label: "Benefits" },
  { key: "prevention", label: "Preventative Aging Care" },
];

export function ConcernTabs({ data }: { data: ConcernPageData }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const rootRef = useRef<HTMLDivElement>(null);
  const { concern, clinics, providers, services } = data;
  const details = concern.details as Record<string, string> | null;

  // "Book Appointment" links to #clinics — open the Clinics tab and scroll here.
  useEffect(() => {
    const goToClinics = () => {
      if (window.location.hash === "#clinics") {
        setTab("Clinics & Diagnosis");
        setTimeout(
          () => rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          60
        );
      }
    };
    goToClinics();
    window.addEventListener("hashchange", goToClinics);
    return () => window.removeEventListener("hashchange", goToClinics);
  }, []);

  return (
    <div ref={rootRef} id="clinics" className="flex flex-col scroll-mt-[110px]">
      {/* Tabs Row */}
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-[14px] mb-8 sm:mb-10 lg:overflow-x-auto pb-2">
        {TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`box-border flex h-[50px] sm:h-[63px] items-center justify-center rounded-[16px] px-[18px] sm:px-[24px] py-[1px] text-[15px] sm:text-[18px] font-medium leading-[116%] tracking-[0.02em] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] flex-none whitespace-nowrap ${
                active
                  ? "bg-[#E2CCE2] text-[#616161]"
                  : "bg-[#FFFFFF] text-[#616161] hover:bg-zinc-50"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {tab === "Overview" && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
             {/* "What are Wrinkles?" Section */}
             <div className="mb-[20px]">
               <h2 className="text-[24px] font-normal leading-[116%] tracking-[-0.04em] text-[#373634]">
                  What are <span className="font-fraunces italic font-normal">{concern.name}?</span>
               </h2>
               {concern.overview && (
                 <p className="text-[16px] leading-[150%] text-[#616161] mt-3 max-w-3xl">
                   {concern.overview}
                 </p>
               )}
             </div>
             
             {/* Dynamic Details Container */}
             {details && (
               <div className="flex flex-col lg:flex-row gap-[28px] sm:gap-[36px] bg-[#FFFFFF] border border-[#DEDEDE] rounded-[18px] p-6 sm:p-[40px] shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]">
                 
                 {/* Left Column (Lists) */}
                 <div className="flex flex-col gap-[24px] lg:w-[539px] shrink-0">
                   {LEFT_FIELDS.map((field) => {
                     const text = details[field.key];
                     if (!text) return null;
                     const title = field.key === "causes" ? `Causes of ${concern.name}` : field.label;
                     return (
                       <div key={field.key} className="flex flex-col gap-[8px]">
                         <div className="flex items-center gap-[12px]">
                           <ArrowRight className="w-5 h-5 text-[#EE97C6] shrink-0 stroke-[2]" />
                           <h3 className="text-[16px] font-semibold leading-[150%] tracking-[0.02em] text-[#575757]">
                             {title}
                           </h3>
                         </div>
                         <p className="text-[14px] leading-[150%] tracking-[0.02em] text-[#575757]">
                           {text}
                         </p>
                       </div>
                     );
                   })}
                 </div>

                 {/* Vertical/Horizontal Divider */}
                 <div className="hidden lg:block w-[1px] bg-[rgba(229,199,218,0.4)] self-stretch"></div>
                 <div className="block lg:hidden h-[1px] w-full bg-[rgba(229,199,218,0.4)]"></div>

                 {/* Right Column (Cards Grid) */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-[24px] flex-1">
                   {CARD_FIELDS.map((field) => {
                     const text = details[field.key];
                     if (!text) return null;
                     return (
                       <div key={field.key} className="flex flex-col gap-[8px] bg-[#FFFFFF] rounded-[16px] p-5 sm:p-[24px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] h-full">
                         <h4 className="text-[18px] font-semibold leading-[150%] tracking-[0.02em] text-[#575757]">
                           {field.label}
                         </h4>
                         <p className="text-[14px] leading-[150%] tracking-[0.02em] text-[#575757]">
                           {text}
                         </p>
                       </div>
                     );
                   })}
                 </div>

               </div>
             )}
          </section>
        )}

        {tab === "Clinics & Diagnosis" && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {clinics.length === 0 ? (
              <Empty label="No clinics offering these treatments yet." />
            ) : (
              <div className="-mt-14 sm:-mt-[100px]">
                <ClinicsCarousel clinics={clinics} />
              </div>
            )}
          </section>
        )}

        {tab === "Doctors & Providers" && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {providers.length === 0 ? (
              <Empty label="Provider profiles for this concern are coming soon." />
            ) : (
              <div className="-mt-14 sm:-mt-[100px]">
                <ProvidersCarousel providers={providers} />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center text-[16px] text-[#727272]">
      {label}
    </div>
  );
}
