/**
 * ingest-services.ts — refresh ONLY the treatments/services for the given
 * clinic domains. Does NOT touch locations / images / providers / hours /
 * booking / concerns — only clinic_services (+ the shared services catalog).
 * The clinic must already exist.
 *
 *   bun --env-file=.env scripts/ingest-services.ts ruma.com ar-aesthetics.com
 *
 * Needs DATABASE_URL + the ingest AI key in the environment / .env.
 */

import pool, { query } from "../src/lib/db";
import { ingestServicesByDomain } from "../src/lib/ingest/ingest-services";

async function main() {
  const domains = process.argv.slice(2).filter(Boolean);
  if (domains.length === 0) {
    console.error("usage: bun scripts/ingest-services.ts <domain> [more...]");
    process.exit(1);
  }

  for (const domain of domains) {
    process.stdout.write(`→ ${domain} … `);
    try {
      const r = await ingestServicesByDomain(domain);
      console.log(
        `${r.status} | slug=${r.slug ?? "-"} | model=${r.modelUsed || "-"} | ` +
          `found=${r.found} matched=${r.matched} auto=${r.auto} unmatched=${r.unmatched}` +
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
  console.error("✗ ingest-services failed:", err);
  await pool.end();
  process.exit(1);
});
