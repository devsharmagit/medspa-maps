/**
 * ingest-one.ts — ingest a SINGLE website into medspa-map (for testing/verify).
 *
 *   bun scripts/ingest-one.ts <domain-or-url> [more...]
 *   bun scripts/ingest-one.ts germaindermatology.com 88aestheticandwellness.com
 *
 * Runs the full pipeline on each arg — clinic DETAILS (ingestClinicByDomain:
 * name/locations/images/providers/before-after) then TREATMENTS
 * (ingestServicesByDomain, a separate call so treatments can be re-run alone
 * later via scripts/ingest-services.ts) — then refreshes the search matview.
 * Concerns are NOT part of this (run scripts/ingest-concerns.ts, or
 * scripts/ingest-treatments-concerns.ts to do both at once).
 * Needs DATABASE_URL + ANTHROPIC_API_KEY in the environment / .env.
 */

import pool, { query } from "../src/lib/db";
import { ingestClinicByDomain } from "../src/lib/ingest/ingest-clinic";
import { ingestServicesByDomain } from "../src/lib/ingest/ingest-services";

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
      let svcNote = "services=skipped(no clinic)";
      if (r.status === "saved") {
        const s = await ingestServicesByDomain(domain);
        svcNote = `services=${s.matched + s.auto + s.unmatched}`;
      }
      console.log(
        `${r.status} | model=${r.modelUsed || "-"}${r.escalated ? "(escalated)" : ""} | ` +
          `locs=${r.locations} | geo=${r.geocoded} | imgs=${r.images} | providers=${r.providers ?? 0} | ${svcNote} | b&a=${r.beforeAfter ?? 0}` +
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
