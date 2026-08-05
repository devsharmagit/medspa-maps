/**
 * scripts/validate-payload.ts — gate a staged clinic payload before it is allowed
 * near the DB. Read-only; exits non-zero if any payload fails a HARD check.
 *
 *   bun --env-file=.env scripts/validate-payload.ts <file-or-dir> [--allowlist path]
 *
 * The checks exist because a payload can be perfectly valid JSON and still be
 * wrong in ways that are expensive to undo once written:
 *
 *  H1 parses, and has website/name/at least one treatment/a located city+state
 *     (US state only — Canadian province codes are hard-rejected)
 *  H2 every `treatments` entry is an OBJECT with a general_name. A plain string is
 *     accepted by the save layer and then mints a brand-new catalog row per
 *     variant — the single largest source of catalog fragmentation.
 *  H3 every general_name is either in the allowlist or declared in
 *     new_general_names, and no more than 5 are declared (>3 warns).
 *  H4 `website` host equals the payload's own filename domain. The report only
 *     clears a row when clinics.website host == the harvested G99 domain, and the
 *     G99 ids are attached by that same lookup, so drift here fails silently.
 *  H5 no G99 placeholder email.
 *  H6 before_after is disjoint from cover+gallery (the images unique key has no
 *     role column, so a shared URL makes one insert a silent no-op).
 *  H7 clinic_type is one of the known values.
 *
 *  Soft warnings: isServiceNoise survivors, concerns on a day_spa_salon,
 *  duplicate addresses, missing cover.
 */
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { isServiceNoise, isConcernNoise, normalize } from "../src/lib/taxonomy/canonical";
import { websiteDomain } from "../src/lib/admin/clinic-save";

const CLINIC_TYPES = new Set([
  "medspa", "plastic_surgery", "cosmetic_derm", "dental_aesthetics",
  "day_spa_salon", "wellness_plus_aesthetics", "other_medical_plus_aesthetics",
]);
const PLACEHOLDER_EMAIL = /^(seo\.loginuser|onboarding\.india)@growth99\.com$/i;
// US-only directory: reject Canadian provinces (2-letter, so they'd otherwise
// pass the "is 2 letters" check silently — see canadian-clinics-excluded-2026-08-04.csv).
const CA_PROVINCES = new Set(["ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "NL", "PE", "YT", "NT", "NU"]);

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--")) ?? "";
const alIdx = args.indexOf("--allowlist");
const allowlistPath = alIdx >= 0 ? args[alIdx + 1] : "reports/retriage-2026-07-29/catalog/allowlist-services.txt";
if (!target) throw new Error("usage: bun scripts/validate-payload.ts <file-or-dir> [--allowlist path]");

const allow = new Set(
  readFileSync(allowlistPath, "utf8").split("\n").map((s) => normalize(s.trim())).filter(Boolean)
);

const files = statSync(target).isDirectory()
  ? readdirSync(target).filter((f) => f.endsWith(".json")).map((f) => join(target, f))
  : [target];

let hardTotal = 0;
for (const file of files) {
  const dom = basename(file).replace(/\.json$/, "");
  const hard: string[] = [];
  const soft: string[] = [];
  let p: Record<string, any>;
  try {
    p = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.log(`\n✗ ${dom}\n   H1 unparseable JSON: ${e instanceof Error ? e.message : e}`);
    hardTotal++;
    continue;
  }

  // H1 required fields
  if (!p.website) hard.push("H1 missing website");
  if (!p.name) hard.push("H1 missing name");
  const tx: unknown[] = Array.isArray(p.treatments) ? p.treatments : [];
  if (tx.length === 0) hard.push("H1 no treatments — clinic would answer no query");
  const locs: any[] = Array.isArray(p.locations) ? p.locations : [];
  if (locs.length === 0) hard.push("H1 no locations");
  locs.forEach((l, i) => {
    if (!l?.city || !l?.state) hard.push(`H1 location[${i}] missing city/state`);
    if (l?.state && String(l.state).length !== 2) hard.push(`H1 location[${i}] state "${l.state}" not 2-letter`);
    if (l?.state && CA_PROVINCES.has(String(l.state).toUpperCase())) hard.push(`H1 location[${i}] state "${l.state}" is a Canadian province — this directory is US-only`);
  });
  const addrs = locs.map((l) => normalize(String(l?.address ?? "")));
  if (new Set(addrs.filter(Boolean)).size !== addrs.filter(Boolean).length) soft.push("duplicate location address");

  // H2 + H3 treatments
  const declared = new Set(
    (Array.isArray(p.new_general_names) ? p.new_general_names : [])
      .map((x: any) => normalize(String(x?.general_name ?? x ?? "")))
      .filter(Boolean)
  );
  const unapproved: string[] = [];
  for (const t of tx) {
    if (typeof t === "string") { hard.push(`H2 plain-string treatment "${t}" (must be {raw_name,general_name})`); continue; }
    const o = t as Record<string, any>;
    const raw = String(o.raw_name ?? "").trim();
    const gen = String(o.general_name ?? "").trim();
    if (!raw) { hard.push("H2 treatment with empty raw_name"); continue; }
    if (!gen) { hard.push(`H2 "${raw}" has no general_name`); continue; }
    const n = normalize(gen.replace(/[®™©]/g, ""));
    if (!allow.has(n) && !declared.has(n)) unapproved.push(gen);
    if (isServiceNoise(raw)) soft.push(`isServiceNoise would DROP "${raw}"`);
  }
  for (const u of [...new Set(unapproved)]) hard.push(`H3 general_name not in allowlist and not declared: "${u}"`);
  if (declared.size > 5) hard.push(`H3 ${declared.size} new_general_names declared (max 5)`);
  else if (declared.size > 3) soft.push(`${declared.size} new catalog rows declared (budget 3)`);

  // H4 website host
  if (p.website && websiteDomain(String(p.website)) !== dom.toLowerCase()) {
    hard.push(`H4 website host "${websiteDomain(String(p.website))}" != payload domain "${dom}"`);
  }
  // H5 placeholder email
  if (p.email && PLACEHOLDER_EMAIL.test(String(p.email))) hard.push(`H5 G99 placeholder email ${p.email}`);
  // H6 before_after disjoint
  const img = p.images ?? {};
  const shown = new Set<string>([...(img.cover ? [img.cover] : []), ...(img.gallery ?? [])]);
  for (const b of img.before_after ?? []) {
    if (shown.has(b)) hard.push(`H6 before_after URL also used as cover/gallery: ${b}`);
  }
  // H7 clinic_type
  if (!p.clinic_type) hard.push("H7 missing clinic_type");
  else if (!CLINIC_TYPES.has(String(p.clinic_type))) hard.push(`H7 unknown clinic_type "${p.clinic_type}"`);

  // soft
  if (!img.cover) soft.push("no cover image (hero shows placeholder)");
  const cons: string[] = Array.isArray(p.concerns) ? p.concerns : [];
  if (p.clinic_type === "day_spa_salon" && cons.length > 0) soft.push(`day_spa_salon with ${cons.length} concerns (brief says [])`);
  for (const c of cons) if (isConcernNoise(c)) soft.push(`isConcernNoise would DROP "${c}"`);

  const ok = hard.length === 0;
  hardTotal += hard.length ? 1 : 0;
  console.log(
    `\n${ok ? "✓" : "✗"} ${dom}  [${p.clinic_type ?? "?"}]  tx=${tx.length} concerns=${cons.length} ` +
      `locs=${locs.length} providers=${(p.providers ?? []).length} new_names=${declared.size}`
  );
  for (const h of hard) console.log(`   HARD  ${h}`);
  for (const s of [...new Set(soft)]) console.log(`   warn  ${s}`);
}

console.log(`\n${files.length} payload(s); ${hardTotal} with hard failures`);
if (hardTotal > 0) process.exit(1);
