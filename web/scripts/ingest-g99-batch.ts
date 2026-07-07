/**
 * ingest-g99-batch.ts — Phase 1 pilot: ingest 10 G99 websites into medspa-map.
 *
 *   bun scripts/ingest-g99-batch.ts
 *
 * Picks 7 multi-location domains (incl. livewellmd.net, the 7-location example)
 * + 3 single-location domains from g99_websites, runs the AI ingest pipeline on
 * each, then refreshes the search matview. Basic details + multi-location only —
 * no treatments/providers/reviews.
 */

import pool, { query } from "../src/lib/db";
import { ingestClinicByDomain, type IngestResult } from "../src/lib/ingest/ingest-clinic";

async function pickDomains(): Promise<string[]> {
  const rows = await query<{ domain: string }>(`
    (SELECT domain FROM g99_clinic_websites
       WHERE (domain = 'livewellmd.net' OR clinic_count > 1)
       ORDER BY (domain = 'livewellmd.net') DESC, clinic_count DESC, domain
       LIMIT 7)
    UNION ALL
    (SELECT domain FROM g99_clinic_websites
       WHERE clinic_count = 1
       ORDER BY domain
       LIMIT 3)
  `);
  return rows.map((r) => r.domain);
}

async function main() {
  const domains = await pickDomains();
  console.log(`\n▶ Ingesting ${domains.length} domains:\n  ${domains.join("\n  ")}\n`);

  const results: IngestResult[] = [];
  for (const domain of domains) {
    process.stdout.write(`→ ${domain} … `);
    try {
      const r = await ingestClinicByDomain(domain);
      results.push(r);
      console.log(
        `${r.status} | model=${r.modelUsed || "-"}${r.escalated ? "(escalated)" : ""} | ` +
          `locs=${r.locations} (ai=${r.aiLocations}, g99=${r.g99Locations}) | ` +
          `geo=${r.geocoded} | imgs=${r.images}${r.note ? ` | ${r.note}` : ""}`
      );
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
      results.push({
        domain,
        status: "failed",
        locations: 0,
        geocoded: 0,
        images: 0,
        aiLocations: 0,
        g99Locations: 0,
        modelUsed: "",
        escalated: false,
        note: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log("\n→ Refreshing clinic_search_view …");
  await query("REFRESH MATERIALIZED VIEW public.clinic_search_view");

  const saved = results.filter((r) => r.status === "saved");
  const totalLocs = saved.reduce((n, r) => n + r.locations, 0);
  const totalGeo = saved.reduce((n, r) => n + r.geocoded, 0);
  const escalations = saved.filter((r) => r.escalated).length;
  console.log(
    `\n✅ Done. saved=${saved.length}/${results.length} | ` +
      `locations=${totalLocs} | geocoded=${totalGeo} | escalations=${escalations}`
  );

  await pool.end();
}

main().catch(async (err) => {
  console.error("✗ batch failed:", err);
  await pool.end();
  process.exit(1);
});
