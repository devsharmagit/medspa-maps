/**
 * ingest-before-after.ts — refresh ONLY the Before/After photos for the given
 * clinic domains. Does NOT touch locations / cover / logo / gallery / providers /
 * services — only role='before_after' image rows. The clinic must already exist.
 *
 *   bun --env-file=.env scripts/ingest-before-after.ts ruma.com ar-aesthetics.com
 *
 * Needs DATABASE_URL + the ingest AI key (INGEST_PROVIDER=gemini → GEMINI_API_KEY)
 * in the environment / .env. Domains run sequentially to pace the AI classifier.
 */

import pool from "../src/lib/db";
import { ingestBeforeAfterByDomain } from "../src/lib/ingest/ingest-before-after";

async function main() {
  const domains = process.argv.slice(2).filter(Boolean);
  if (domains.length === 0) {
    console.error("usage: bun scripts/ingest-before-after.ts <domain> [more...]");
    process.exit(1);
  }

  for (const domain of domains) {
    process.stdout.write(`→ ${domain} … `);
    try {
      const r = await ingestBeforeAfterByDomain(domain);
      console.log(
        `${r.status} | slug=${r.slug ?? "-"} | found=${r.found} inserted=${r.inserted} deleted=${r.deleted}` +
          `${r.note ? ` | ${r.note}` : ""}`
      );
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("✗ ingest-before-after failed:", err);
  await pool.end();
  process.exit(1);
});
