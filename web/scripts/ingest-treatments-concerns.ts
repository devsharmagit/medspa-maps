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
      const r = await ingestTreatmentsAndConcernsByDomain(domain, { trigger: "cli" });
      console.log(
        `  ${r.status} | slug=${r.slug ?? "-"} | pages=${r.pagesFetched} | model=${r.modelUsed || "-"}`
      );
      console.log(
        `  treatments=${r.treatmentsFound} matched=${r.servicesMatched} auto=${r.servicesAuto} ` +
          `dropped=${r.servicesDropped}`
      );
      console.log(
        `  concerns=${r.concernsSaved}/${r.concernsFound}` +
          `${r.createdConcerns.length ? ` | new concerns: ${r.createdConcerns.join(", ")}` : ""}` +
          `${r.note ? ` | ${r.note}` : ""}`
      );
      if (r.added.length || r.removed.length) {
        console.log(`  changes (run ${r.runId}):`);
        for (const c of r.added) console.log(`    + ${c.entityType} ${c.name}`);
        for (const c of r.removed) console.log(`    - ${c.entityType} ${c.name}`);
      } else {
        console.log(`  changes: none`);
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
