import type { ConcernProvider } from "@/lib/providers/queries";

/**
 * Static "Providers Spotlight" list for the landing page — the OWNER of each
 * featured clinic, snapshotted from the DB (no runtime query). Order matches the
 * admin featured list. "View Clinic" links resolve via `clinic_slug`.
 *
 * Regenerate with: bun --env-file=.env scripts/dump-owners.ts (owner = the
 * provider whose card_tagline is set). Beauty Lab + Laser is intentionally
 * absent — it has no scraped provider/team data yet.
 */
export const SPOTLIGHT_PROVIDERS: ConcernProvider[] = [
  {
    id: "80a93c03-a228-4981-89ce-0b5b670f4022",
    name: "Shelby Miller",
    title: "CEO, Medical Director, Founder, DNP, FNP-C",
    card_tagline: "Passionate about helping her patients become the best form of themselves.",
    image_url: "https://ruma.com/storage/2025/11/SHELBY-HEADSHOT.webp",
    is_verified: false,
    clinic_slug: "ruma-medical",
    clinic_name: "RUMA Medical",
  },
  {
    id: "74047fb7-a375-48c2-95c8-686cb01e7390",
    name: "Trevor Larsen",
    title: "Owner / Elite Injector",
    card_tagline: "Transforming beauty with expertise and care",
    image_url: "https://trubeautybytrevor.com/storage/2026/06/trevor-larsen-rn.webp",
    is_verified: false,
    clinic_slug: "tru-beauty-by-trevor",
    clinic_name: "Tru Beauty By Trevor",
  },
  {
    id: "27014b75-03c0-4445-994c-df057c47e82a",
    name: "Brandi Milton",
    title: "NP-C, Master Injector & Founder",
    card_tagline: "Empowering clients to radiate confidence from the inside out.",
    image_url: "https://www.conqraesthetics.com/storage/2024/10/brandi2-1024x1024.jpg",
    is_verified: false,
    clinic_slug: "conqr-aesthetics-wellness",
    clinic_name: "Conqr Aesthetics & Wellness",
  },
  {
    id: "548f1bb2-4ca0-4c82-aad9-e6f47cae5f1e",
    name: "Gretchen Frieling",
    title: "MD, Founder",
    card_tagline: "Harvard-trained, triple board-certified Dermatopathologist",
    image_url: "https://gfacemd.com/storage/2026/03/IMG_9394-scaled.webp",
    is_verified: false,
    clinic_slug: "gfacemd",
    clinic_name: "GFaceMD",
  },
  {
    id: "85ec89b1-0ec7-4154-9ea3-ae8676428e1d",
    name: "Amy Lynn",
    title: "RN, CANS",
    card_tagline: "Founder and visionary behind Glo Derma and Glo Academy",
    image_url: "https://gloderma.com/storage/2025/04/AMY-LYNN-RN-CANS.webp",
    is_verified: false,
    clinic_slug: "glo-derma",
    clinic_name: "Glo Derma",
  },
];
