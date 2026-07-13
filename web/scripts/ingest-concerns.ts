/**
 * ingest-concerns.ts — refresh ONLY the evidence-based concerns for the given
 * clinic domains. Touches clinic_concerns (source='scraped') + evidence rows;
 * never locations / images / providers / services. Clinics must already exist.
 *
 *   bun --env-file=.env scripts/ingest-concerns.ts ruma.com medimorph.com
 *
 * Prints a full per-clinic report: accepted concerns with their verbatim
 * evidence quotes + treatment pairings, and every AI item rejected by the
 * quote verifier (with the reason). Domains run sequentially (AI rate limits).
 */

import pool from "../src/lib/db";
import { ingestConcernsByDomain } from "../src/lib/ingest/ingest-concerns";

async function main() {
  const domains = process.argv.slice(2).filter(Boolean);
  if (domains.length === 0) {
    console.error("usage: bun scripts/ingest-concerns.ts <domain> [more...]");
    process.exit(1);
  }

  for (const domain of domains) {
    console.log(`\n━━━ ${domain} ━━━`);
    try {
      const r = await ingestConcernsByDomain(domain);
      console.log(
        `${r.status} | slug=${r.slug ?? "-"} | pages=${r.pagesFetched} | model=${r.modelUsed || "-"} | ` +
          `concerns=${r.concerns.length} | rejected=${r.rejected.length}` +
          `${r.createdConcerns.length ? ` | new-catalog: ${r.createdConcerns.join(", ")}` : ""}` +
          `${r.note ? ` | ${r.note}` : ""}`
      );
      for (const c of r.concerns) {
        console.log(`  ✔ ${c.general_name}`);
        for (const ev of c.evidences) {
          const pair = ev.paired_treatments.length
            ? `  [via ${ev.paired_treatments.join(", ")}]`
            : "";
          console.log(`      "${ev.evidence_quote.slice(0, 110)}"${pair}`);
          console.log(`      ↳ ${ev.source_url}`);
        }
      }
      for (const rej of r.rejected) {
        console.log(
          `  ✘ ${rej.item.general_name} ("${rej.item.raw_phrase}") — ${rej.reason}`
        );
      }
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("✗ ingest-concerns failed:", err);
  await pool.end();
  process.exit(1);
});
