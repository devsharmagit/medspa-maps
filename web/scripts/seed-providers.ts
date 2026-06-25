/**
 * seed-providers.ts — seeds one provider per clinic
 * Run with: bun scripts/seed-providers.ts
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const PHOTO_URL =
  "https://images.stockcake.com/public/1/9/d/19d13828-c999-4e2d-a191-9da4dd8bd824_large/confident-medical-professional-stockcake.jpg";

/** One provider definition per clinic (matched by clinic name keyword) */
const PROVIDERS: Record<
  string,
  {
    name: string;
    title: string;
    bio: string;
    years_experience: number;
    highlights: string[];
    credentials: { title: string; institution: string }[];
    specialties: { title: string; description: string }[];
  }
> = {
  // Aesthetic Medical Lounge
  "Aesthetic Medical lounge – Island Park": {
    name: "Dr. Olivia Harte",
    title: "Aesthetic Medicine Physician",
    bio: "Dr. Olivia Harte is a board-certified physician specializing in non-surgical aesthetic treatments. With a decade of experience on Long Island, she is known for her precise, natural-looking results and patient-first philosophy.",
    years_experience: 10,
    highlights: [
      "Board-Certified Physician",
      "Natural Results Specialist",
      "Injectable Expert",
      "Patient-Centered Care",
    ],
    credentials: [
      { title: "Doctor of Medicine (MD)", institution: "Columbia University College of Physicians" },
      { title: "Board-Certified Internal Medicine", institution: "American Board of Internal Medicine" },
      { title: "Advanced Aesthetic Training", institution: "Allergan Medical Institute" },
    ],
    specialties: [
      { title: "Injectables", description: "Botox, Dysport, and dermal fillers for facial rejuvenation with a natural touch." },
      { title: "Skin Revitalization", description: "Medical-grade peels, microneedling, and laser treatments for lasting skin health." },
    ],
  },
  "Aesthetic Medical lounge – Long Beach": {
    name: "Dr. Sophia Mercer",
    title: "Cosmetic Dermatology Specialist",
    bio: "Dr. Sophia Mercer brings compassion and clinical precision to every patient. She has helped thousands of patients on Long Island look and feel their best through personalized aesthetic plans.",
    years_experience: 8,
    highlights: [
      "Cosmetic Dermatology Expert",
      "Expert in Skin Health",
      "Personalized Treatment Plans",
      "Non-Surgical Specialist",
    ],
    credentials: [
      { title: "Doctor of Medicine (MD)", institution: "NYU School of Medicine" },
      { title: "Dermatology Residency", institution: "Mount Sinai Hospital, New York" },
      { title: "Fellow, American Academy of Dermatology", institution: "AAD" },
    ],
    specialties: [
      { title: "Facial Rejuvenation", description: "Comprehensive approaches to smooth fine lines and restore youthful contours." },
      { title: "Preventative Aesthetics", description: "Personalized plans to help you age gracefully and confidently." },
    ],
  },
  // Beauty Lab + Laser
  "Beauty Lab + Laser – Salt Lake City": {
    name: "Jessica Aldridge, NP",
    title: "Nurse Practitioner – Laser & Injectables",
    bio: "Jessica Aldridge is a licensed Nurse Practitioner with deep expertise in laser treatments and advanced injectables. She combines her clinical background with an artistic eye to deliver stunning, natural results.",
    years_experience: 7,
    highlights: [
      "Certified Laser Specialist",
      "Injectable Expert",
      "Natural Looking Results",
      "Board-Certified NP",
    ],
    credentials: [
      { title: "Master of Science in Nursing (MSN)", institution: "University of Utah" },
      { title: "Board-Certified Family Nurse Practitioner", institution: "AANP" },
      { title: "Certified Laser Safety Officer", institution: "National Council on Laser Certification" },
    ],
    specialties: [
      { title: "Laser Hair Removal", description: "Safe and effective permanent hair reduction for all skin types." },
      { title: "Skin Health", description: "Medical-grade skincare and treatments to improve overall skin quality." },
    ],
  },
  // Beauty at the Lake
  "Beauty at the Lake – Coeur dAlene": {
    name: "Ashley Monroe, RN",
    title: "Registered Nurse – Aesthetic Specialist",
    bio: "Ashley Monroe is a passionate aesthetic nurse with a love for helping her clients feel radiant and confident. Based in beautiful Coeur d'Alene, she offers a warm, boutique experience with clinical-grade results.",
    years_experience: 6,
    highlights: [
      "Registered Nurse",
      "Injectable Specialist",
      "Boutique Aesthetic Experience",
      "Skin Wellness Expert",
    ],
    credentials: [
      { title: "Bachelor of Science in Nursing (BSN)", institution: "Gonzaga University" },
      { title: "Advanced Training in Aesthetics", institution: "Galderma Aesthetics Academy" },
      { title: "Member, Aesthetic Nurse Society", institution: "ANS" },
    ],
    specialties: [
      { title: "Injectables", description: "Botox, Juvederm, and Restylane for a refreshed, natural look." },
      { title: "Preventative Aesthetics", description: "Early intervention strategies to maintain youthful, healthy skin." },
    ],
  },
  // GFaceMD
  "GFaceMD – Wellesley": {
    name: "Dr. Grace Kim, MD",
    title: "Medical Director & Aesthetic Physician",
    bio: "Dr. Grace Kim is the founder and medical director of GFaceMD. A Harvard-trained physician, she is dedicated to providing the most advanced, evidence-based aesthetic treatments in a warm and welcoming environment.",
    years_experience: 15,
    highlights: [
      "Harvard-Trained Physician",
      "Medical Director",
      "Evidence-Based Aesthetics",
      "15+ Years Experience",
    ],
    credentials: [
      { title: "Doctor of Medicine (MD)", institution: "Harvard Medical School" },
      { title: "Residency in Dermatology", institution: "Massachusetts General Hospital" },
      { title: "Fellow, American Society for Dermatologic Surgery", institution: "ASDS" },
    ],
    specialties: [
      { title: "Facial Rejuvenation", description: "Signature full-face treatments combining injectables, lasers, and skin health." },
      { title: "Body Contouring", description: "Non-invasive body sculpting and fat reduction treatments." },
      { title: "Skin Health", description: "Advanced medical skincare protocols for all skin types." },
    ],
  },
  // GloDerma
  "GloDerma – Yardley,": {
    name: "Dr. Rachel Penn, MD",
    title: "Board-Certified Dermatologist",
    bio: "Dr. Rachel Penn is a board-certified dermatologist with a special passion for cosmetic dermatology. She treats patients throughout the greater Philadelphia area with a focus on comprehensive, whole-skin wellness.",
    years_experience: 12,
    highlights: [
      "Board-Certified Dermatologist",
      "Cosmetic Dermatology Expert",
      "Whole-Skin Wellness",
      "Philadelphia Area Leader",
    ],
    credentials: [
      { title: "Doctor of Medicine (MD)", institution: "Jefferson Medical College" },
      { title: "Dermatology Residency", institution: "Penn Medicine" },
      { title: "Fellow, American Academy of Dermatology", institution: "AAD" },
    ],
    specialties: [
      { title: "Injectables", description: "Expert administration of Botox, Dysport, Juvederm, and more." },
      { title: "Skin Health", description: "Medical-grade treatments targeting acne, hyperpigmentation, and aging." },
    ],
  },
  // Ruma Medical
  "Ruma Medical – Lehi": {
    name: "Dr. Larissa Joe, NP",
    title: "Injectable Specialist",
    bio: "Dr. Larissa Joe is a board-certified Nurse Practitioner specializing in facial aesthetics and injectable treatments. With a passion for natural results and patient education, she believes in enhancing your beauty while maintaining what makes you uniquely you.",
    years_experience: 10,
    highlights: [
      "Board Certified Nurse Practitioner",
      "Expert in Facial Aesthetics",
      "Natural Looking Results",
      "Patient-Centered Care",
    ],
    credentials: [
      { title: "Board-Certified Nurse Practitioner", institution: "American Nurses Credentialing Center (ANCC)" },
      { title: "Master of Science in Nursing (MSN)", institution: "University of Utah" },
      { title: "Bachelor of Science in Nursing (BSN)", institution: "Brigham Young University" },
      { title: "Advanced Training in Aesthetics", institution: "Allergan Medical Institute & Galderma Aesthetics" },
      { title: "Member", institution: "American Association of Nurse Practitioners (AANP)" },
    ],
    specialties: [
      { title: "Injectables", description: "Botox, Dysport, Xeomin, and dermal fillers for natural-looking results." },
      { title: "Facial Rejuvenation", description: "Comprehensive approaches to smooth fine lines and restore youthful contours." },
      { title: "Skin Health", description: "Medical-grade skincare and treatments to improve overall skin quality." },
      { title: "Preventative Aesthetics", description: "Personalized treatment plans to help you age gracefully and confidently." },
    ],
  },
  // Tru Beauty
  "Tru Beauty By Trevor – Henderson,": {
    name: "Trevor Nash, NP",
    title: "Nurse Practitioner & Founder",
    bio: "Trevor Nash is a certified nurse practitioner and the founder of Tru Beauty. Known for his meticulous artistry and warm bedside manner, Trevor has built one of Henderson's most beloved aesthetic practices from the ground up.",
    years_experience: 9,
    highlights: [
      "Practice Founder",
      "Board-Certified NP",
      "Artistic Injectable Technique",
      "Men & Women's Aesthetics",
    ],
    credentials: [
      { title: "Master of Science in Nursing (MSN)", institution: "University of Nevada, Las Vegas" },
      { title: "Board-Certified Nurse Practitioner", institution: "AANP" },
      { title: "Certified in Advanced Injectables", institution: "Allergan Medical Institute" },
    ],
    specialties: [
      { title: "Injectables", description: "Signature Botox and filler techniques for men and women in Henderson, NV." },
      { title: "Preventative Aesthetics", description: "Start early and stay ahead of the aging process with customized protocols." },
    ],
  },
};

async function seed() {
  const client = await pool.connect();

  try {
    // Fetch all active clinics
    const { rows: clinics } = await client.query<{
      id: string;
      name: string;
    }>("SELECT id, name FROM clinics WHERE is_active = true ORDER BY name");

    console.log(`Found ${clinics.length} active clinics\n`);

    let inserted = 0;
    let skipped = 0;

    for (const clinic of clinics) {
      // Find matching provider definition
      const providerDef = PROVIDERS[clinic.name];

      if (!providerDef) {
        console.log(`⚠  No provider definition for: "${clinic.name}" — skipping`);
        skipped++;
        continue;
      }

      // Check if a provider already exists for this clinic
      const { rows: existing } = await client.query(
        "SELECT id FROM providers WHERE clinic_id = $1 LIMIT 1",
        [clinic.id]
      );

      if (existing.length > 0) {
        console.log(`↩  Skipping "${clinic.name}" — provider already exists`);
        skipped++;
        continue;
      }

      await client.query(
        `INSERT INTO providers
           (clinic_id, name, title, bio, image_url, years_experience,
            is_verified, highlights, credentials, specialties)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          clinic.id,
          providerDef.name,
          providerDef.title,
          providerDef.bio,
          PHOTO_URL,
          providerDef.years_experience,
          true, // is_verified
          JSON.stringify(providerDef.highlights),
          JSON.stringify(providerDef.credentials),
          JSON.stringify(providerDef.specialties),
        ]
      );

      console.log(`✓  Inserted provider "${providerDef.name}" for "${clinic.name}"`);
      inserted++;
    }

    console.log(`\n✅ Done — ${inserted} inserted, ${skipped} skipped`);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
