import pool from "@/lib/db";

// Default fallback icon for treatments without specific images
const DEFAULT_ICON = "/images/landingpage/diamond.png";

// Canonical list of 15 priority treatments with their slugs and display names
// Using fallback icon for treatments that don't have specific images yet
const POPULAR_TREATMENTS = [
  { slug: "botox", name: "Botox", icon: "/images/landingpage/botox.png" },
  { slug: "dermal-fillers", name: "Dermal Fillers", icon: "/images/landingpage/fillers.png" },
  { slug: "kybella", name: "Kybella", icon: DEFAULT_ICON }, // No specific image
  { slug: "pdo-threads", name: "PDO Threads", icon: DEFAULT_ICON }, // No specific image
  { slug: "prp-prf", name: "PRP / PRF", icon: DEFAULT_ICON }, // No specific image
  { slug: "microneedling", name: "Microneedling", icon: "/images/landingpage/microneedling.png" },
  { slug: "chemical-peels", name: "Chemical Peels", icon: "/images/landingpage/checmical-peel.png" },
  { slug: "hydrafacial", name: "HydraFacial", icon: DEFAULT_ICON }, // No specific image
  { slug: "rf-skin-tightening", name: "RF Skin Tightening", icon: "/images/landingpage/skin-resurfacing.png" }, // Using skin-resurfacing as fallback
  { slug: "ultherapy", name: "Ultherapy", icon: DEFAULT_ICON }, // No specific image
  { slug: "laser-skin-resurfacing", name: "Laser Resurfacing", icon: "/images/landingpage/laser.png" },
  { slug: "laser-hair-removal", name: "Laser Hair Removal", icon: "/images/landingpage/laser.png" }, // Reusing laser icon
  { slug: "ipl-photofacial", name: "IPL / Photofacial", icon: "/images/landingpage/laser.png" }, // Reusing laser icon
  { slug: "coolsculpting", name: "CoolSculpting", icon: "/images/landingpage/body-countring.png" }, // Using body contouring icon
  { slug: "body-contouring", name: "Body Contouring", icon: "/images/landingpage/body-countring.png" },
] as const;

export interface PopularTreatment {
  slug: string;
  name: string;
  clinicCount: number;
  icon: string;
}

/**
 * Fetches the 15 priority treatments with real clinic counts from the database.
 * Only returns treatments that exist in the services table and have active clinics.
 */
export async function getPopularTreatments(): Promise<PopularTreatment[]> {
  // Fetch clinic counts for all treatments in one query
  const { rows } = await pool.query<{ slug: string; clinic_count: string }>(
    `SELECT s.slug, 
            COUNT(DISTINCT cl.id)::text AS clinic_count
     FROM services s
     LEFT JOIN clinic_services cs ON cs.service_id = s.id AND cs.is_active = true
     LEFT JOIN clinics cl ON cl.id = cs.clinic_id AND cl.is_active = true
     WHERE s.is_active = true
       AND s.slug = ANY($1)
     GROUP BY s.slug`,
    [POPULAR_TREATMENTS.map(t => t.slug)]
  );

  // Create a map of slug -> clinic count
  const clinicCountMap = new Map(
    rows.map(r => [r.slug, parseInt(r.clinic_count, 10)])
  );

  // Build the result array, only including treatments that exist in the database
  const results: PopularTreatment[] = [];
  
  for (const treatment of POPULAR_TREATMENTS) {
    const clinicCount = clinicCountMap.get(treatment.slug);
    
    // Only include if the treatment exists in the database and has clinics
    if (clinicCount !== undefined && clinicCount > 0) {
      results.push({
        slug: treatment.slug,
        name: treatment.name,
        clinicCount,
        icon: treatment.icon,
      });
    }
  }

  return results;
}
