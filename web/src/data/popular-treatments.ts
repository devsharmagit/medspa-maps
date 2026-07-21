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
  Flame,
  Sparkles,
  Layers,
  Sun,
} from "lucide-react";

/**
 * Static homepage "Popular Treatments" list — the 15 treatments with the
 * highest clinic counts (per a 2026-07-21 DB snapshot), each with a distinct
 * lucide-react icon. clinicCount is a hand-maintained snapshot from the
 * `clinics`/`clinic_services` tables — same intentionally-static approach as
 * src/data/top-states.ts; refresh by hand if the counts drift meaningfully.
 */

export interface PopularTreatment {
  slug: string;
  name: string;
  clinicCount: number;
  icon: LucideIcon;
}

export const POPULAR_TREATMENTS: PopularTreatment[] = [
  { slug: "botox", name: "Botox", clinicCount: 559, icon: Syringe },
  { slug: "dermal-fillers", name: "Dermal Fillers", clinicCount: 521, icon: Droplet },
  { slug: "microneedling", name: "Microneedling", clinicCount: 426, icon: CircleDot },
  { slug: "chemical-peels", name: "Chemical Peels", clinicCount: 344, icon: FlaskConical },
  { slug: "laser-hair-removal", name: "Laser Hair Removal", clinicCount: 312, icon: Wand2 },
  { slug: "medical-weight-loss", name: "Medical Weight Loss", clinicCount: 308, icon: Scale },
  { slug: "prp-prf", name: "PRP (Platelet-Rich Plasma)", clinicCount: 274, icon: Droplets },
  { slug: "iv-therapy", name: "IV Therapy", clinicCount: 271, icon: GlassWater },
  { slug: "sculptra", name: "Sculptra", clinicCount: 231, icon: Gem },
  { slug: "hydrafacial", name: "HydraFacial", clinicCount: 178, icon: Waves },
  { slug: "dysport", name: "Dysport", clinicCount: 172, icon: Wand },
  { slug: "kybella", name: "Kybella", clinicCount: 167, icon: Flame },
  { slug: "facials", name: "Facials", clinicCount: 142, icon: Sparkles },
  { slug: "pdo-threads", name: "PDO Threads", clinicCount: 120, icon: Layers },
  { slug: "ipl-photofacial", name: "IPL / Photofacial", clinicCount: 96, icon: Sun },
];
