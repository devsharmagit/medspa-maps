import type { LucideIcon } from "lucide-react";
import {
  Syringe,
  Droplet,
  CircleDot,
  FlaskConical,
  Wand2,
  Scale,
  Droplets,
  GlassWater,
  Gem,
  Waves,
  Wand,
  Sparkles,
  Sun,
  Zap,
  Layers,
  Aperture,
  Smile,
  HeartPulse,
  Flame,
  Lightbulb,
  Pill,
} from "lucide-react";

/**
 * Static homepage "Popular Treatments" list.
 *
 * Since the 2026-09-06 catalog reduction this is the WHOLE public treatment
 * catalog — all 19 core treatments, ordered by clinic count — not a top-N slice
 * of a longer list. Every slug here must be one of the 19; a slug that is not
 * active in `services` links to a search that returns nothing.
 *
 * clinicCount is a hand-maintained snapshot (2026-09-07), same intentionally
 * static approach as src/data/top-states.ts.
 *
 * These MUST equal what the search dropdown shows, or a card promises a count
 * the search then contradicts. That means one source only:
 *
 *   getSearchOptionCounts(new URLSearchParams())   // lib/search/option-counts.ts
 *
 * national scope, which is the same function the dropdown calls. Do NOT
 * hand-roll the SQL: the obvious form
 * `LEFT JOIN clinics cl ON cl.id = cs.clinic_id AND cl.is_active` does not drop
 * rows for inactive clinics and over-reports by ~30 (it is what once made a
 * coverage figure read 102%). option-counts.ts uses a scope CTE plus an
 * `IN (SELECT …)` membership test instead, which is correct.
 *
 * Drift is not silent: scripts/verify-core-links.ts fails the build check when
 * any number here is more than 10% off the live count.
 *
 * The previous snapshot was taken mid-reduction — after the catalog cut but
 * before the website-verified backfill landed — so every figure was low and Lip
 * Fillers read 40 against a real 403.
 */

export interface PopularTreatment {
  slug: string;
  name: string;
  clinicCount: number;
  icon: LucideIcon;
}

export const POPULAR_TREATMENTS: PopularTreatment[] = [
  { slug: "facials", name: "Facials", clinicCount: 593, icon: Sparkles },
  { slug: "botox", name: "Botox®", clinicCount: 579, icon: Syringe },
  { slug: "microneedling", name: "Microneedling", clinicCount: 576, icon: CircleDot },
  { slug: "dermal-fillers", name: "Dermal Fillers", clinicCount: 568, icon: Droplet },
  { slug: "chemical-peels", name: "Chemical Peels", clinicCount: 511, icon: FlaskConical },
  { slug: "laser-treatments", name: "Laser Treatments", clinicCount: 487, icon: Aperture },
  { slug: "prp-prf", name: "PRP / PRF Therapy", clinicCount: 478, icon: Droplets },
  { slug: "laser-hair-removal", name: "Laser Hair Removal", clinicCount: 421, icon: Wand2 },
  { slug: "body-contouring", name: "Body Contouring", clinicCount: 405, icon: HeartPulse },
  { slug: "lip-fillers", name: "Lip Fillers", clinicCount: 403, icon: Smile },
  { slug: "medical-weight-loss", name: "Medical Weight Loss", clinicCount: 402, icon: Scale },
  { slug: "sculptra", name: "Sculptra®", clinicCount: 399, icon: Gem },
  { slug: "dysport", name: "Dysport®", clinicCount: 395, icon: Wand },
  { slug: "iv-therapy", name: "IV Therapy", clinicCount: 368, icon: GlassWater },
  { slug: "laser-skin-resurfacing", name: "Laser Skin Resurfacing", clinicCount: 359, icon: Zap },
  { slug: "ipl-photofacial", name: "IPL Photofacial", clinicCount: 348, icon: Sun },
  { slug: "hair-restoration", name: "Hair Restoration", clinicCount: 339, icon: Flame },
  { slug: "rf-microneedling", name: "RF Microneedling", clinicCount: 322, icon: Layers },
  { slug: "hydrafacial", name: "HydraFacial®", clinicCount: 258, icon: Waves },
  // Added 2026-09-12 (19 -> 22 core treatments). Counts from the website-verified
  // coverage backfill (national scope), same source as the search dropdown.
  // NOTE: Cryotherapy is a core, fully searchable treatment but is intentionally
  // NOT featured here — aesthetic cryotherapy is a niche offering (18 clinics), and
  // the common fat-freezing "cryo" devices are counted under Body Contouring. So
  // this carousel is a curated subset, not the whole 22-treatment catalog.
  { slug: "hormone-therapy", name: "Hormone Therapy", clinicCount: 234, icon: Pill },
  { slug: "red-light-therapy", name: "Red Light Therapy", clinicCount: 200, icon: Lightbulb },
];
