/**
 * scripts/fetch-clinic-ratings.ts
 *
 * Populate clinics.ext_rating / ext_review_count for every active clinic:
 *   1. FREE — scrape the clinic's own website for a published
 *      schema.org AggregateRating (JSON-LD / microdata).
 *   2. FALLBACK — Google Places API (New), only if GOOGLE_PLACES_API_KEY is
 *      set in the environment. Silently skipped otherwise (no error) — the
 *      free-source coverage still gets recorded.
 *
 * Never touches avg_rating/review_count (those are OUR internal review
 * data) — only the ext_* columns, which exist specifically for third-party
 * ratings and are already read by the search API and clinic pages.
 *
 * Usage:
 *   bun scripts/fetch-clinic-ratings.ts                 # all active clinics
 *   bun scripts/fetch-clinic-ratings.ts --limit 50       # first 50 only
 *   bun scripts/fetch-clinic-ratings.ts --force          # re-check clinics that already have a rating
 *   bun scripts/fetch-clinic-ratings.ts --clinic <uuid>  # single clinic
 */
import "dotenv/config";
import pool from "../src/lib/db";
import { resolveClinicRating } from "../src/lib/ratings/fetch-rating";

interface ClinicRow {
  id: string;
  name: string;
  website: string | null;
  google_place_id: string | null;
  city: string | null;
  state: string | null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    limit: get("--limit") ? parseInt(get("--limit")!, 10) : null,
    force: args.includes("--force"),
    clinicId: get("--clinic") ?? null,
  };
}

async function main() {
  const { limit, force, clinicId } = parseArgs();
  const hasGoogleFallback = Boolean(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACE_API_KEY);

  console.log(
    `Fetching clinic ratings — free website scrape first, Google Places fallback ${
      hasGoogleFallback ? "ENABLED" : "DISABLED (no GOOGLE_PLACES_API_KEY set)"
    }.`,
  );

  // city/state live in clinic_locations now (dropped from clinics) — join the
  // primary active location for the Google Places text-search query.
  const conditions = ["c.is_active = true", "c.website IS NOT NULL", "trim(c.website) <> ''"];
  const params: unknown[] = [];
  if (!force) conditions.push("c.ext_rating IS NULL");
  if (clinicId) {
    params.push(clinicId);
    conditions.push(`c.id = $${params.length}`);
  }
  let sql = `
    SELECT c.id, c.name, c.website, c.google_place_id, ploc.city, ploc.state
      FROM clinics c
      LEFT JOIN LATERAL (
        SELECT city, state FROM clinic_locations
         WHERE clinic_id = c.id AND is_active = true
         ORDER BY is_primary DESC, sort_order NULLS LAST, created_at
         LIMIT 1
      ) ploc ON TRUE
     WHERE ${conditions.join(" AND ")}
     ORDER BY c.name`;
  if (limit) sql += ` LIMIT ${limit}`;

  const { rows } = await pool.query<ClinicRow>(sql, params);
  console.log(`${rows.length} clinic(s) to check.\n`);

  let foundWebsite = 0;
  let foundGoogle = 0;
  let notFound = 0;
  let errors = 0;

  for (const clinic of rows) {
    try {
      const query = [clinic.name, clinic.city, clinic.state].filter(Boolean).join(", ");
      const result = await resolveClinicRating({
        website: clinic.website,
        placeId: clinic.google_place_id,
        query: query || null,
      });

      if (!result) {
        notFound++;
        console.log(`—    ${clinic.name} — no rating from either source`);
        continue;
      }

      await pool.query(
        `UPDATE clinics
            SET ext_rating = $2, ext_review_count = $3,
                ext_rating_source = $4, ext_rating_updated_at = NOW(),
                updated_at = NOW()
          WHERE id = $1`,
        [clinic.id, result.rating, result.reviewCount, result.source],
      );

      if (result.source === "website") foundWebsite++;
      else foundGoogle++;

      const icon = result.source === "website" ? "🌐" : "📍";
      console.log(
        `${icon}   ${clinic.name} — ${result.rating}★ (${result.reviewCount ?? "?"} reviews) via ${result.source}`,
      );
    } catch (err) {
      errors++;
      console.log(`✗    ${clinic.name} — ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\n── Summary ──");
  console.log(`  Found via website (free):  ${foundWebsite}`);
  console.log(`  Found via Google Places:   ${foundGoogle}`);
  console.log(`  Not found anywhere:        ${notFound}`);
  console.log(`  Errors:                    ${errors}`);
  console.log(`  Total checked:             ${rows.length}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
