/**
 * ingest-one.ts — ingest a SINGLE website into medspa-map (for testing/verify).
 *
 *   bun scripts/ingest-one.ts <domain-or-url> [more...]
 *   bun scripts/ingest-one.ts germaindermatology.com 88aestheticandwellness.com
 *
 * Runs the AI ingest pipeline on each arg, then refreshes the search matview.
 * Needs DATABASE_URL + ANTHROPIC_API_KEY in the environment / .env.
 */

import pool, { query } from "../src/lib/db";
import { ingestClinicByDomain } from "../src/lib/ingest/ingest-clinic";

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
      console.log(
        `${r.status} | model=${r.modelUsed || "-"}${r.escalated ? "(escalated)" : ""} | ` +
          `locs=${r.locations} | geo=${r.geocoded} | imgs=${r.images} | providers=${r.providers ?? 0} | services=${r.services ?? 0}` +
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
