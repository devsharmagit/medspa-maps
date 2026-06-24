"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react";

interface GalleryImage {
  source_url: string;
  alt_text: string | null;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Full-screen image viewer with arrow / keyboard navigation + thumbnail strip. */
function Lightbox({
  images,
  index,
  setIndex,
  onClose,
  name,
}: {
  images: GalleryImage[];
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
  name: string;
}) {
  const count = images.length;
  const next = useCallback(() => setIndex((index + 1) % count), [index, count, setIndex]);
  const prev = useCallback(
    () => setIndex((index - 1 + count) % count),
    [index, count, setIndex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, next, prev]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} photos`}
    >
      <div
        className="flex items-center justify-between px-5 py-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium">
          {name} · {index + 1} / {count}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-2 transition hover:bg-white/10"
        >
          <X className="size-6" />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        {count > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 sm:left-6"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index].source_url}
          alt={images[index].alt_text || `${name} photo ${index + 1}`}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
        {count > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute right-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 sm:right-6"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {count > 1 && (
        <div
          className="flex justify-center gap-2 overflow-x-auto px-5 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`View photo ${i + 1}`}
              className={`shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                i === index
                  ? "ring-white"
                  : "opacity-50 ring-transparent hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.source_url}
                alt=""
                className="size-14 object-cover sm:size-16"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Hero gallery: a large primary image + up to 4 thumbnails. Every tile (and the
 * "+N View All" overlay) opens the shared lightbox.
 */
export function ClinicGallery({
  images,
  total,
  name,
}: {
  images: GalleryImage[];
  total: number;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  const primary = images[0] ?? null;
  if (!primary) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#d96f8e]/20 to-[#9b3a9b]/20">
        <span className="text-5xl font-semibold text-white/60">
          {initials(name)}
        </span>
      </div>
    );
  }

  const thumbs = images.slice(1, 5);
  const remaining = total - 5;

  return (
    <>
      <div className="flex h-full flex-col gap-3">
        <button
          type="button"
          onClick={() => openAt(0)}
          className="group relative block overflow-hidden rounded-2xl shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={primary.source_url}
            alt={primary.alt_text || name}
            className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition group-hover:bg-black/70">
            <Images className="size-3.5" />
            {total > 1 ? `View all ${total} photos` : "View photo"}
          </span>
        </button>

        {thumbs.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {thumbs.map((img, i) => {
              const isLast = i === thumbs.length - 1;
              const showOverlay = isLast && remaining > 0;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => openAt(i + 1)}
                  className="group relative overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.source_url}
                    alt={img.alt_text || name}
                    className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.06]"
                    loading="lazy"
                  />
                  {showOverlay && (
                    <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-center text-xs font-semibold text-white backdrop-blur-[1px] transition group-hover:bg-black/65">
                      <span className="text-base leading-none">+{remaining}</span>
                      View All
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <Lightbox
          images={images}
          index={index}
          setIndex={setIndex}
          onClose={() => setOpen(false)}
          name={name}
        />
      )}
    </>
  );
}

/**
 * Before & After: a responsive thumbnail grid that opens the shared lightbox.
 * Shows up to `visible` tiles with a "+N" overlay on the last when there are more.
 */
export function BeforeAfterGallery({
  images,
  total,
  name,
  visible = 8,
}: {
  images: GalleryImage[];
  total: number;
  name: string;
  visible?: number;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  if (images.length === 0) return null;

  const tiles = images.slice(0, visible);
  const remaining = total - tiles.length;

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((img, i) => {
          const isLast = i === tiles.length - 1;
          const showOverlay = isLast && remaining > 0;
          return (
            <button
              type="button"
              key={i}
              onClick={() => openAt(i)}
              className="group relative overflow-hidden rounded-2xl shadow-sm ring-1 ring-zinc-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.source_url}
                alt={img.alt_text || `${name} before and after`}
                className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.05]"
                loading="lazy"
              />
              {showOverlay && (
                <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-center text-sm font-semibold text-white backdrop-blur-[1px] transition group-hover:bg-black/65">
                  <span className="text-lg leading-none">+{remaining}</span>
                  View All
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open && (
        <Lightbox
          images={images}
          index={index}
          setIndex={setIndex}
          onClose={() => setOpen(false)}
          name={name}
        />
      )}
    </>
  );
}
