/**
 * ingest-one.ts — ingest a SINGLE website into medspa-map (for testing/verify).
 *
 *   bun --env-file=.env scripts/ingest-one.ts <domain-or-url> [more...]
 *   bun --env-file=.env scripts/ingest-one.ts germaindermatology.com
 *
 * Runs the full pipeline on each arg — clinic DETAILS (ingestClinicByDomain:
 * name/locations/images/providers/before-after) then TREATMENTS + CONCERNS via
 * the shared engine the admin importers and the scheduled refresh both use — then
 * refreshes the search matview.
 *
 * To re-run treatments/concerns alone on an existing clinic, use
 * scripts/ingest-treatments-concerns.ts.
 *
 * Needs DATABASE_URL + OPENAI_API_KEY in the environment / .env.
 */

import pool, { query } from "../src/lib/db";
import { ingestClinicByDomain } from "../src/lib/ingest/ingest-clinic";
import { ingestTreatmentsAndConcernsForClinic } from "../src/lib/ingest/ingest-treatments-concerns";

async function main() {
  const domains = process.argv.slice(2);
  if (domains.length === 0) {
    console.error("usage: bun scripts/ingest-one.ts <domain> [more...]");
    process.exit(1);
  }

  for (const domain of domains) {
    process.stdout.write(`→ ${domain} … `);
    try {
      const r = await ingestClinicByDomain(domain);
      let tcNote = "treatments=skipped(no clinic)";
      if (r.status === "saved" && r.clinicId) {
        const tc = await ingestTreatmentsAndConcernsForClinic(r.clinicId, { trigger: "cli" });
        tcNote = `treatments=${tc.treatmentsFound} concerns=${tc.concernsSaved}`;
      }
      console.log(
        `${r.status} | model=${r.modelUsed || "-"}${r.escalated ? "(escalated)" : ""} | ` +
          `locs=${r.locations} | geo=${r.geocoded} | imgs=${r.images} | providers=${r.providers ?? 0} | ${tcNote} | b&a=${r.beforeAfter ?? 0}` +
          `${r.note ? ` | ${r.note}` : ""}`
      );
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("→ Refreshing clinic_search_view …");
  await query("REFRESH MATERIALIZED VIEW public.clinic_search_view");
  await pool.end();
}

main().catch(async (err) => {
  console.error("✗ ingest-one failed:", err);
  await pool.end();
  process.exit(1);
});
