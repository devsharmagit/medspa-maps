"use client";

import { useState, useMemo } from "react";
import { ChevronDown, BadgeCheck, Star, CalendarDays, ArrowLeft } from "lucide-react";

export interface SharedClinicData {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  website: string | null;
  booking_url: string | null;
  avg_rating: string | null;
  review_count: number;
  verified: boolean;
  featured: boolean;
  distance_km?: number | null;
  cover_image?: string | null;
  images?: { source_url: string; role: string; sort_order: number }[];
}

export function ClinicsCarousel({ clinics }: { clinics: SharedClinicData[] }) {
  const [sortBy, setSortBy] = useState<"Distance" | "Rating">("Distance");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  const sortedClinics = useMemo(() => {
    return [...clinics].sort((a, b) => {
      // 1. Featured always on top
      if (a.featured !== b.featured) return a.featured ? -1 : 1;

      // 2. Sort by selected option
      if (sortBy === "Distance") {
        if (a.distance_km == null && b.distance_km == null) {
            // fallback to rating if no distance
            const ar = Number(a.avg_rating) || 0;
            const br = Number(b.avg_rating) || 0;
            if (ar !== br) return br - ar;
            return (b.review_count || 0) - (a.review_count || 0);
        }
        if (a.distance_km == null) return 1;
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      } else {
        const ar = Number(a.avg_rating) || 0;
        const br = Number(b.avg_rating) || 0;
        if (ar !== br) return br - ar;
        return (b.review_count || 0) - (a.review_count || 0);
      }
    });
  }, [clinics, sortBy]);

  const totalPages = Math.ceil(sortedClinics.length / itemsPerPage) || 1;
  const currentClinics = sortedClinics.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <section className="mt-[100px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[34px] font-normal leading-[116%] tracking-[-0.04em] text-[#373634]">
            Best Clinics <span className="font-fraunces italic font-normal">Near You</span>
          </h2>
          <p className="mt-2 text-[20px] font-normal leading-[116%] text-[#373634] capitalize">
            {sortedClinics.length} Clinics Found
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[14px] text-[#9A9A9A]" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>Sorted by:</span>
          <div className="relative">
             <select 
               value={sortBy}
               onChange={(e) => {
                  setSortBy(e.target.value as "Distance" | "Rating");
                  setCurrentPage(1);
               }}
               className="appearance-none cursor-pointer flex items-center justify-between rounded-[4px] border border-[#D2C3D3] bg-white px-5 py-2 pr-10 min-w-[150px] text-[14px] text-[#727272] outline-none shadow-sm"
             >
                <option value="Distance">Distance</option>
                <option value="Rating">Rating</option>
             </select>
             <ChevronDown className="size-4 text-[#353535] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {currentClinics.map((c) => {
          const bookUrl = c.booking_url || c.website;
          const coverImageSrc = c.cover_image || (c.images?.find(img => img.role === 'cover') || c.images?.[0])?.source_url;
          const thumbnails = c.images?.filter(img => img.source_url !== coverImageSrc) || [];
          const displayThumbnails = thumbnails.slice(0, 3);
          const hasMoreThumbnails = thumbnails.length > 3;
          
          return (
            <div
              key={c.id}
              className="flex flex-col overflow-hidden rounded-[18px] border border-[#DEDEDE] bg-white p-6 shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)]"
            >
              <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-[11px] bg-[#D9D9D9]">
                {coverImageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverImageSrc}
                    alt={c.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-zinc-200" />
                )}
                {c.featured && (
                  <span className="absolute left-4 top-4 rounded-[4px] bg-[#D3A845] px-2 py-1 text-[12px] font-semibold uppercase tracking-[0.02em] text-white">
                    FEATURED
                  </span>
                )}
              </div>
              
              {/* Thumbnails row */}
              {displayThumbnails.length > 0 && (
                 <div className="mb-6 flex gap-3 h-[88px]">
                    {displayThumbnails.map((thumb, idx) => (
                       <div key={idx} className="flex-1 overflow-hidden rounded-[8px] bg-zinc-100 relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb.source_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          {idx === 2 && hasMoreThumbnails && (
                             <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">
                                <span className="text-[20px] font-semibold text-white">+{thumbnails.length - 2}</span>
                             </div>
                          )}
                       </div>
                    ))}
                 </div>
              )}

              <div className="flex flex-col flex-1 justify-between gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 max-w-[200px]">
                    <h3 className="text-[20px] font-medium leading-[116%] text-[#383838] truncate">
                      {c.name}
                    </h3>
                    {c.verified && (
                      <BadgeCheck className="size-[18px] shrink-0 fill-[#CF5D9A] text-white" />
                    )}
                  </div>
                  {c.avg_rating != null && c.review_count > 0 && (
                     <div className="flex items-center gap-1.5 text-[12px] text-[#727272]">
                       <span>{c.avg_rating}</span>
                       <Star className="size-4 fill-[#FFBA19] text-[#FFBA19]" />
                       <span className="opacity-90">({c.review_count})</span>
                     </div>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  {bookUrl ? (
                    <a
                      href={bookUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] px-6 py-[10px] text-[14px] font-semibold text-white shadow-sm transition hover:opacity-95 h-[48px]"
                    >
                       Book Appointment <CalendarDays className="size-[20px]" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-zinc-100 px-6 py-[10px] text-[14px] font-semibold text-zinc-400 h-[48px]">
                       Book Appointment <CalendarDays className="size-[20px]" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
         <div className="mt-12 flex items-center justify-center gap-3">
           <button 
             onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
             disabled={currentPage === 1}
             className="flex h-[50px] w-[98px] items-center justify-end pr-4 rounded-r-full bg-gradient-to-r from-transparent to-white text-[#815E42] hover:bg-zinc-50 rotate-180 origin-center disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <ArrowLeft className="size-[17px] rotate-180" />
           </button>
           <div className="flex gap-[12.5px] flex-wrap justify-center">
              {Array.from({ length: totalPages }).map((_, i) => {
                 const pageNum = i + 1;
                 const isActive = pageNum === currentPage;
                 return (
                    <button 
                       key={pageNum}
                       onClick={() => setCurrentPage(pageNum)}
                       className={`flex h-[50px] w-[50px] items-center justify-center rounded-[12.5px] text-[14px] font-medium shadow-[0px_4px_8px_rgba(0,0,0,0.05)] transition ${
                          isActive 
                             ? "bg-[#CF5D9A] text-white hover:bg-[#b54a83]" 
                             : "bg-white text-[#616161] hover:bg-zinc-50"
                       }`}
                    >
                      {pageNum}
                    </button>
                 );
              })}
           </div>
           <button 
             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
             disabled={currentPage === totalPages}
             className="flex h-[50px] w-[98px] items-center justify-end pr-4 rounded-r-full bg-gradient-to-r from-transparent to-white text-[#815E42] hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <ArrowLeft className="size-[17px] rotate-180" />
           </button>
         </div>
      )}
    </section>
  );
}
