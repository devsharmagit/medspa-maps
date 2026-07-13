/**
 * cleanup-catalog.ts — one-off repair of the polluted AI-grown services/concerns
 * catalogs (see the 2026-07-13 ingest-accuracy work). Cleans IN PLACE:
 *
 *   1. DELETE junk service rows (nav/CTA/footer, category headers, testing,
 *      loyalty/financing, provider names) — clinic_services.service_id → NULL
 *      via FK, and junk unmatched clinic_services raws are removed too.
 *   2. DELETE orphan AI concern rows (0 members AND 0 evidence) + explicit junk.
 *   3. MERGE exact-synonym near-duplicates into one canonical row, REPOINTING
 *      clinic_services / clinic_concerns / clinic_concern_evidence first so
 *      verified evidence is preserved, then deleting the emptied duplicate.
 *   4. Fix casing on surviving AI concern names (the "Crow'S Feet" bug).
 *   5. REFRESH MATERIALIZED VIEW clinic_search_view.
 *
 * Seed (origin='seed') rows are never deleted. Only exact synonyms are merged —
 * specific concerns (Forehead Lines, Frown Lines, Crow's Feet) stay searchable.
 *
 *   bun --env-file=.env scripts/cleanup-catalog.ts          # DRY RUN (prints plan)
 *   bun --env-file=.env scripts/cleanup-catalog.ts --apply  # execute
 */
import pool from "../src/lib/db";
import { isServiceNoise, stripCredentials, normalize } from "../src/lib/taxonomy/canonical";

const APPLY = process.argv.includes("--apply");
const norm = (s: string) => normalize(s);

// ── SERVICES ────────────────────────────────────────────────────────────────

// Junk service names (normalized, exact) — never a searchable treatment.
const SERVICE_DELETE = new Set(
  [
    "ALLĒ", "Aesthetic Services", "Cherry Financing", "Payment Plan",
    "Rewards Programs", "VIP membership", "Purchase A Gift", "Conditions",
    "Explore Services", "In The Media", "Press Release", "Read the post",
    "Products", "Self Assessment", "Sitemap", "Testimonials", "Pre and Post Care",
    "Meet Dr. G", "Meet The Glo Squad", "Trevor Injects", "Raiderettes",
    "View all Chemical Peels", "View all Fat Dissolving Injections",
    "View all Laser Hair Removal", "View all Laser Skin Treatments",
    "View all Tox & Dermal Fillers", "View all Weight Loss",
    "| Privacy Policy", "| Terms and Conditions", "Injectables", "Laser & Wellness",
    "Wellness", "Skincare", "Medical-Grade Skincare", "Alastin Skincare",
    "SkinMedica Skincare", "Biological Age Testing", "Cancer Screening",
    "Gut Health Testing", "Body Composition Analysis", "Diagnostic Testing",
    "Functional Medicine", "Cosmetic Dentistry", "NeuroWellness",
    // concerns miscategorized as services
    "Sagging Skin", "Skin Texture", "Stretch Marks", "Wrinkle Reduction",
    "Double Chin", "Hyperpigmentation Treatment", "Anti-Aging Treatment",
  ].map(norm)
);

// Merge source service name (normalized) → target service SLUG.
const SERVICE_MERGE: Record<string, string> = {};
const svcMerge = (target: string, ...names: string[]) =>
  names.forEach((n) => (SERVICE_MERGE[norm(n)] = target));
svcMerge("facials", "Facial Treatments", "Spa Facials", "Signature Facial",
  "Men’s Signature Facial", "Medical Grade Facials", "Back Facial", "Acne Facial",
  "Dermasound Facial");
svcMerge("laser-skin-resurfacing", "Laser Services", "Laser Treatments",
  "Laser Skin Treatments", "Medical Lasers");
svcMerge("prp-prf", "PRP", "PRF", "PRP/PRF", "Platelet-Derived Growth Factor");
svcMerge("microneedling", "Microneedling with PRP");
svcMerge("botox", "Neurotoxins");
svcMerge("skin-rejuvenation", "Facial Rejuvenation");
svcMerge("hair-loss-treatment", "Hair Regrowth Program");
svcMerge("medical-weight-loss", "Weight Management");

// ── CONCERNS ──────────────────────────────────────────────────────────────

// Explicit concern junk (by slug), even if they carry members/evidence.
const CONCERN_DELETE = new Set<string>([
  "hydration", "medical-weight-loss", "injectable-weight-loss", "fat-dissolving",
  "hormonal-imbalance", "skin-problems", "nutrient-deficiencies",
]);

// Merge source concern SLUG → target concern SLUG.
const CONCERN_MERGE: Record<string, string> = {};
const conMerge = (target: string, ...slugs: string[]) =>
  slugs.forEach((s) => (CONCERN_MERGE[s] = target));
conMerge("fine-lines-wrinkles", "fine-lines", "fine-lines-and-wrinkles",
  "deep-wrinkles", "wrinkles", "wrinkle-reduction", "wrinkles-and-loss-of-volume",
  "early-signs-of-aging");
conMerge("crows-feet", "crows-feet-around-the-eyes");
conMerge("frown-lines", "frown-lines-the-11s-between-the-eyebrows", "scowl-lines-11s");
conMerge("skin-laxity-sagging", "sagging", "sagging-skin", "skin-laxity");
conMerge("scars", "scar", "scarring");
conMerge("acne-scars", "acne-scarring", "acne-scars-and-other-mild-scarring");
conMerge("hyperpigmentation", "melasma", "pigmentation", "uneven-skin-tone",
  "brown-spots-age-spots");
conMerge("skin-texture", "uneven-skin-tone-texture", "texture");
conMerge("volume-loss", "hollows", "hollowed-areas", "hollowing-under-the-eyes",
  "under-eye-hollows", "tired-sunken-eyes");
conMerge("hyperhidrosis", "excessive-sweating", "hyperhidrosis-excessive-sweating");
conMerge("weight-loss", "weight-management", "weight-fluctuations");
conMerge("dimpled-chin", "chin");
conMerge("stretch-marks", "stretchmark");
conMerge("hair-loss", "hormonal-hair-loss");
conMerge("acne", "back-focused-acne");

// Title-case a survivor concern name (fixes "Crow'S Feet"), preserving acronyms.
function titleCaseWord(w: string): string {
  if (!w) return w;
  if (/\d/.test(w)) return w;
  const letters = w.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 2 && letters.length <= 4 && letters === letters.toUpperCase()) return w;
  const i = w.search(/[a-zA-Z]/);
  if (i < 0) return w;
  return w.slice(0, i) + w[i].toUpperCase() + w.slice(i + 1).toLowerCase();
}
const displayName = (s: string) =>
  s.replace(/[®™©]/g, "").replace(/\s+/g, " ").trim().split(" ").map(titleCaseWord).join(" ");

// ── run ───────────────────────────────────────────────────────────────────

const client = await pool.connect();
try {
  await client.query("BEGIN");

  type SRow = { id: string; name: string; slug: string; origin: string; aliases: string[] | null };
  const services = (await client.query<SRow>(
    `SELECT id, name, slug, COALESCE(origin,'seed') origin, aliases FROM services WHERE is_active`
  )).rows;
  const svcBySlug = new Map(services.map((r) => [r.slug, r]));
  const provNorms = new Set(
    (await client.query<{ name: string }>(`SELECT name FROM providers WHERE is_active`)).rows
      .map((r) => stripCredentials(r.name)).filter(Boolean)
  );

  const svcDeleted: string[] = [];
  const svcMerged: string[] = [];
  for (const s of services) {
    if (s.origin === "seed") continue;
    const n = norm(s.name);
    const target = SERVICE_MERGE[n];
    if (target && svcBySlug.has(target) && svcBySlug.get(target)!.id !== s.id) {
      const t = svcBySlug.get(target)!;
      svcMerged.push(`${s.name} → ${t.name}`);
      if (APPLY) {
        await client.query(`UPDATE clinic_services SET service_id=$1 WHERE service_id=$2`, [t.id, s.id]);
        await client.query(
          `UPDATE services SET aliases=(
             SELECT array(SELECT DISTINCT unnest(COALESCE($1::text[],'{}') || COALESCE($2::text[],'{}') || ARRAY[$3]))
           ), updated_at=NOW() WHERE id=$4`,
          [t.aliases, s.aliases, norm(s.name), t.id]
        );
        await client.query(`DELETE FROM services WHERE id=$1`, [s.id]);
      }
      continue;
    }
    if (SERVICE_DELETE.has(n) || isServiceNoise(s.name) || provNorms.has(stripCredentials(s.name))) {
      svcDeleted.push(s.name);
      if (APPLY) await client.query(`DELETE FROM services WHERE id=$1`, [s.id]); // clinic_services.service_id → NULL
    }
  }

  // Purge junk UNMATCHED clinic_services raws (leftover nav rows on clinic pages).
  const unmatched = (await client.query<{ id: string; raw_name: string }>(
    `SELECT id, raw_name FROM clinic_services WHERE service_id IS NULL AND is_active`
  )).rows;
  let junkRaws = 0;
  for (const r of unmatched) {
    if (isServiceNoise(r.raw_name) || provNorms.has(stripCredentials(r.raw_name))) {
      junkRaws++;
      if (APPLY) await client.query(`DELETE FROM clinic_services WHERE id=$1`, [r.id]);
    }
  }

  type CRow = { id: string; name: string; slug: string; origin: string; aliases: string[] | null;
                members: number; evidence: number };
  const concerns = (await client.query<CRow>(
    `SELECT c.id, c.name, c.slug, COALESCE(c.origin,'seed') origin, c.aliases,
       (SELECT COUNT(*)::int FROM clinic_concerns cc WHERE cc.concern_id=c.id AND cc.is_active) members,
       (SELECT COUNT(*)::int FROM clinic_concern_evidence e WHERE e.concern_id=c.id) evidence
     FROM concerns c WHERE c.is_active`
  )).rows;
  const conBySlug = new Map(concerns.map((r) => [r.slug, r]));

  const conDeleted: string[] = [];
  const conMerged: string[] = [];
  const conRecased: string[] = [];
  const mergeTargets = new Set(Object.values(CONCERN_MERGE));
  for (const c of concerns) {
    if (c.origin === "seed") continue;
    const target = CONCERN_MERGE[c.slug];
    if (target && conBySlug.has(target) && conBySlug.get(target)!.id !== c.id) {
      const t = conBySlug.get(target)!;
      conMerged.push(`${c.name} → ${t.name}`);
      if (APPLY) {
        // repoint evidence (skip rows that would collide on the unique key)
        await client.query(
          `UPDATE clinic_concern_evidence e SET concern_id=$1
             WHERE e.concern_id=$2 AND NOT EXISTS (
               SELECT 1 FROM clinic_concern_evidence x WHERE x.clinic_id=e.clinic_id
                 AND x.concern_id=$1 AND x.source_url=e.source_url AND x.raw_phrase=e.raw_phrase)`,
          [t.id, c.id]
        );
        await client.query(`DELETE FROM clinic_concern_evidence WHERE concern_id=$1`, [c.id]);
        // repoint membership (skip clinics already tagged with the target)
        await client.query(
          `UPDATE clinic_concerns cc SET concern_id=$1
             WHERE cc.concern_id=$2 AND NOT EXISTS (
               SELECT 1 FROM clinic_concerns x WHERE x.clinic_id=cc.clinic_id AND x.concern_id=$1)`,
          [t.id, c.id]
        );
        await client.query(`DELETE FROM clinic_concerns WHERE concern_id=$1`, [c.id]);
        await client.query(
          `UPDATE concerns SET aliases=(
             SELECT array(SELECT DISTINCT unnest(COALESCE($1::text[],'{}') || COALESCE($2::text[],'{}') || ARRAY[$3]))
           ), updated_at=NOW() WHERE id=$4`,
          [t.aliases, c.aliases, norm(c.name), t.id]
        );
        await client.query(`DELETE FROM concerns WHERE id=$1`, [c.id]); // cascades clinic_concerns/evidence
      }
      continue;
    }
    const orphan = c.members === 0 && c.evidence === 0;
    if ((CONCERN_DELETE.has(c.slug) || orphan) && !mergeTargets.has(c.slug)) {
      conDeleted.push(`${c.name} (m=${c.members} ev=${c.evidence})`);
      if (APPLY) await client.query(`DELETE FROM concerns WHERE id=$1`, [c.id]);
      continue;
    }
    // survivor — fix casing if needed
    const fixed = displayName(c.name);
    if (fixed !== c.name) {
      conRecased.push(`${c.name} → ${fixed}`);
      if (APPLY) await client.query(`UPDATE concerns SET name=$1, updated_at=NOW() WHERE id=$2`, [fixed, c.id]);
    }
  }

  if (APPLY) {
    await client.query("COMMIT");
    await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`);
  } else {
    await client.query("ROLLBACK");
  }

  const p = (t: string, a: string[]) => {
    console.log(`\n${t} (${a.length}):`);
    a.forEach((x) => console.log(`  ${x}`));
  };
  console.log(APPLY ? "=== APPLIED ===" : "=== DRY RUN (no changes) — pass --apply to execute ===");
  p("SERVICES deleted", svcDeleted);
  p("SERVICES merged", svcMerged);
  console.log(`\nJunk unmatched clinic_services raws removed: ${junkRaws}`);
  p("CONCERNS deleted", conDeleted);
  p("CONCERNS merged", conMerged);
  p("CONCERNS recased", conRecased);
  console.log(
    `\nServices: ${services.length} → ~${services.length - svcDeleted.length - svcMerged.length}` +
    ` | Concerns: ${concerns.length} → ~${concerns.length - conDeleted.length - conMerged.length}`
  );
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
  await pool.end();
}
