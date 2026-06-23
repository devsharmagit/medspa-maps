/**
 * verify-admin-libs.ts — run with: bun scripts/verify-admin-libs.ts
 *
 * READ-ONLY verification of the admin unmatched-queue + scrape-preview libs,
 * importing them the same way routes do (via the @/lib/admin/* alias).
 *
 *   1. listUnmatched(): totals, noise vs real, top-5 real suggestions.
 */
import { listUnmatched } from "@/lib/admin/queue";

async function main() {
  const items = await listUnmatched();
  const total = items.length;
  const noise = items.filter((i) => i.is_noise).length;
  const real = items.filter((i) => !i.is_noise).length;

  console.log(`TOTAL distinct unmatched raw_names : ${total}`);
  console.log(`  is_noise=true (junk)             : ${noise}`);
  console.log(`  real (is_noise=false)            : ${real}`);

  const realWithSuggestion = items.filter((i) => !i.is_noise && i.suggestion);
  console.log(`\nTop 5 REAL suggestions (raw_name -> slug @ confidence):`);
  for (const i of realWithSuggestion.slice(0, 5)) {
    console.log(
      `  [${i.clinic_count} clinics] "${i.raw_name}" -> ${i.suggestion!.slug} @ ${i.suggestion!.confidence}`
    );
  }
  if (realWithSuggestion.length === 0) {
    console.log("  (none with a non-null suggestion)");
  }

  const best = realWithSuggestion[0];
  if (best) {
    console.log(`\nBEST_CANDIDATE_JSON ${JSON.stringify(best)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
