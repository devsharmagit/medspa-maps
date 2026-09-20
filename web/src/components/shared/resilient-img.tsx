"use client";

import { useRef, useState, type ImgHTMLAttributes, type SyntheticEvent } from "react";

const ENABLED = process.env.NEXT_PUBLIC_MEDIA_FALLBACK_ENABLED !== "false";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  /** Hide the element when BOTH the live URL and our stored copy fail. */
  hideOnError?: boolean;
};

/**
 * Drop-in <img> replacement that survives a dead source URL. It renders the live
 * `src` as usual; if that fails to load, it swaps once to our stored copy at
 * `/api/media?u=<src>`. If that also fails, it hides (or fires the caller's
 * onError). Purely client-side — safe to render inside server components.
 */
export function ResilientImg({ src, hideOnError = true, onError, ...rest }: Props) {
  const original = src ?? "";
  const [currentSrc, setCurrentSrc] = useState(original);
  // 0 = showing live URL, 1 = showing /api/media copy, 2 = both failed.
  const phase = useRef(0);

  function handleError(e: SyntheticEvent<HTMLImageElement>) {
    if (
      ENABLED &&
      phase.current === 0 &&
      original &&
      !original.startsWith("/api/media") &&
      !original.startsWith("data:")
    ) {
      phase.current = 1;
      setCurrentSrc(`/api/media?u=${encodeURIComponent(original)}`);
      return;
    }
    phase.current = 2;
    if (hideOnError) {
      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
    }
    onError?.(e);
  }

  // Caller always supplies alt via ...rest; this is a generic <img> wrapper.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img src={currentSrc || undefined} onError={handleError} {...rest} />;
}
