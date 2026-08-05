/**
 * Pre-warm provider expertise summaries so the first modal click is instant.
 *
 * Usage:
 *   bun scripts/prewarm-provider-expertise.ts                # all featured clinics
 *   bun scripts/prewarm-provider-expertise.ts --slug gfacemd # one clinic
 *   bun scripts/prewarm-provider-expertise.ts --slug gfacemd --force  # regenerate
 *
 * Only providers with a headshot are warmed — those are the only ones the clinic
 * page renders (see the providers query in src/lib/clinics/queries.ts). Idempotent:
 * without --force, providers that already have a summary are skipped.
 */
import pool from "@/lib/db";
import { resolveProviderExpertise, type ProviderExpertiseRow } from "@/lib/providers/expertise";

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const slugFlag = argv.indexOf("--slug");
const slug = slugFlag !== -1 ? argv[slugFlag + 1] : undefined;

async function main() {
  const params: string[] = [];
  let where =
    "c.is_active = true AND p.is_active = true AND p.image_url IS NOT NULL AND p.image_url <> ''";
  if (slug) {
    params.push(slug);
    where += ` AND c.slug = $${params.length}`;
  } else {
    where += " AND c.featured = true";
  }

  const { rows } = await pool.query<ProviderExpertiseRow>(
    `SELECT p.id, p.name, p.title, p.card_tagline, p.source_url, p.expertise_summary,
            c.website, c.slug AS clinic_slug
       FROM providers p
       JOIN clinics c ON c.id = p.clinic_id
      WHERE ${where}
      ORDER BY c.slug, (p.card_tagline IS NOT NULL) DESC, p.name`,
    params
  );

  console.log(
    `Pre-warming ${rows.length} providers ${slug ? `for '${slug}'` : "(featured clinics)"}${force ? " [force]" : ""}\n`
  );

  let generated = 0;
  let fallback = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of rows) {
    if (!force && p.expertise_summary && p.expertise_summary.trim()) {
      skipped++;
      continue;
    }
    try {
      const r = await resolveProviderExpertise(p, { force });
      if (r.generated) {
        generated++;
        console.log(`  ✓ ${p.clinic_slug} / ${p.name}`);
      } else {
        fallback++;
        console.log(`  · ${p.clinic_slug} / ${p.name} (fallback — no scrapable bio)`);
      }
    } catch (e) {
      failed++;
      console.log(`  ✗ ${p.clinic_slug} / ${p.name}: ${(e as Error).message}`);
    }
  }

  console.log(
    `\nDone. generated=${generated} fallback=${fallback} skipped=${skipped} failed=${failed}`
  );
  await pool.end();
}

main();
