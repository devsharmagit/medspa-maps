/**
 * Parity harness for the dropdown option counts.
 *
 * The number shown next to an option in the "Treatment or Condition" dropdown
 * must equal the `total` the user gets when they actually search that option at
 * the same location. This script asserts exactly that by hitting BOTH real
 * endpoints over HTTP, so it exercises the true code paths (two separate SQL
 * builders — /api/search-options and /api/search — that must never drift).
 *
 * Usage:  node scripts/verify-option-counts.mjs [baseUrl]
 * Requires the dev server to be running (default http://localhost:3000).
 */

const BASE = process.argv[2] || "http://localhost:3000";

/** Scopes to check — one per branch of resolveLocationScope(). */
const SCOPES = [
  { name: "national", params: {} },
  { name: "LA coords / 50mi", params: { location: "Los Angeles, CA" } },
  { name: "LA coords / 20mi", params: { location: "Los Angeles, CA", radius: "20" } },
  { name: "state CA", params: { location: "CA" } },
  { name: "bare zip 37203", params: { location: "37203" } },
];

/** How many of the top options (plus a broad concern) to verify per scope. */
const TOP_N = 8;
// Broad concerns expand to child slugs in the search engine; if the counts
// endpoint forgets that expansion these two are where it shows up.
const MUST_CHECK_CONCERNS = ["fine-lines-wrinkles", "skin-laxity-sagging"];

async function getJson(path, params) {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** `total` from the real search engine for one option at one scope. */
async function searchTotal(kind, slug, params) {
  const body = await getJson("/api/search", {
    ...params,
    ...(kind === "treatment" ? { q: slug } : { condition: slug }),
    limit: "1",
  });
  return body.total;
}

let checked = 0;
let failed = 0;

for (const scope of SCOPES) {
  const opts = await getJson("/api/search-options", scope.params);
  const { treatments, concerns } = opts.data;

  // Ordering contract: counts must arrive descending.
  for (const [label, list] of [["treatments", treatments], ["concerns", concerns]]) {
    for (let i = 1; i < list.length; i++) {
      if (list[i].count > list[i - 1].count) {
        console.error(`  ✗ ${scope.name}: ${label} not sorted desc at index ${i}`);
        failed++;
        break;
      }
    }
  }

  const sample = [
    ...treatments.slice(0, TOP_N).map((o) => ["treatment", o]),
    ...treatments.slice(-2).map((o) => ["treatment", o]),
    ...concerns.slice(0, TOP_N).map((o) => ["concern", o]),
    ...MUST_CHECK_CONCERNS.map((slug) => ["concern", concerns.find((c) => c.slug === slug)]).filter(
      ([, o]) => o,
    ),
  ];

  console.log(`\n${scope.name} — ${treatments.length} treatments, ${concerns.length} concerns`);
  for (const [kind, opt] of sample) {
    const total = await searchTotal(kind, opt.slug, scope.params);
    checked++;
    if (total !== opt.count) {
      failed++;
      console.error(`  ✗ ${kind} ${opt.slug}: dropdown=${opt.count} search=${total}`);
    } else {
      console.log(`  ✓ ${kind} ${opt.slug} = ${opt.count}`);
    }
  }
}

console.log(`\n${checked} checked, ${failed} mismatched`);
process.exit(failed === 0 ? 0 : 1);
