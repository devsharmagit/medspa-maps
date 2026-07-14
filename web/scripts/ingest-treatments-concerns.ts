/**
 * ingest-treatments-concerns.ts — refresh TREATMENTS + CONCERNS together for
 * the given clinic domains using one AI extraction pass. Does NOT touch
 * locations / images / providers / hours / booking. The clinic must already
 * exist.
 *
 *   bun --env-file=.env scripts/ingest-treatments-concerns.ts ruma.com
 *
 * Needs DATABASE_URL + the ingest AI key in the environment / .env.
 */

import pool, { query } from "../src/lib/db";
import { ingestTreatmentsAndConcernsByDomain } from "../src/lib/ingest/ingest-treatments-concerns";

async function main() {
  const domains = process.argv.slice(2).filter(Boolean);
  if (domains.length === 0) {
    console.error("usage: bun scripts/ingest-treatments-concerns.ts <domain> [more...]");
    process.exit(1);
  }

  for (const domain of domains) {
    console.log(`→ ${domain}`);
    try {
      const r = await ingestTreatmentsAndConcernsByDomain(domain);
      console.log(
        `  ${r.status} | slug=${r.slug ?? "-"} | pages=${r.pagesFetched} | model=${r.modelUsed || "-"}`
      );
      console.log(
        `  treatments=${r.treatmentsFound} matched=${r.servicesMatched} auto=${r.servicesAuto} ` +
          `unmatched=${r.servicesUnmatched}`
      );
      console.log(
        `  mappings: ai=${r.mappingsFound} saved=${r.mappingsSaved}` +
          ` | concerns=${r.concernsSaved}/${r.concernsFound}` +
          `${r.createdConcerns.length ? ` | new concerns: ${r.createdConcerns.join(", ")}` : ""}` +
          `${r.note ? ` | ${r.note}` : ""}`
      );
      for (const a of r.associations.slice(0, 25)) {
        console.log(`    ${a.service_name} -> ${a.concern_name}`);
      }
      if (r.associations.length > 25) {
        console.log(`    ... ${r.associations.length - 25} more`);
      }
    } catch (err) {
      console.log(`  FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("→ Refreshing clinic_search_view …");
  await query("REFRESH MATERIALIZED VIEW public.clinic_search_view");
  await pool.end();
}

main().catch(async (err) => {
  console.error("✗ ingest-treatments-concerns failed:", err);
  await pool.end();
  process.exit(1);
});
