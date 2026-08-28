import { Info } from "lucide-react";

/**
 * Shared YMYL medical disclaimer. Identical wording across every educational
 * article; rendered from here so there's one source of truth.
 */
export function MedicalDisclaimer() {
  return (
    <aside className="mt-10 flex gap-3 rounded-[14px] border border-[#F0E2EC] bg-[#faf7fb] px-5 py-4">
      <Info className="mt-0.5 size-[18px] shrink-0 text-[#CF5B9D]" aria-hidden />
      <p className="font-montserrat text-[13px] leading-[1.6] text-zinc-600 sm:text-[14px]">
        <span className="font-semibold text-zinc-700">Medical disclaimer:</span> This
        article is for general educational purposes only and is not medical advice. It is
        not intended to diagnose, treat, prevent, or cure any condition. Individual results
        vary, and whether a treatment is right for you can only be determined by a licensed
        medical provider during a consultation.
      </p>
    </aside>
  );
}
