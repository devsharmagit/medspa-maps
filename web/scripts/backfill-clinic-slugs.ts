/**
 * backfill-clinic-slugs.ts — run with: bun scripts/backfill-clinic-slugs.ts
 *
 * Regenerates every active clinic's slug to slugify(name) — i.e. the clinic
 * name only, with no city/state suffix. Historically some import paths appended
 * the city (e.g. "aesthetic-medical-lounge-long-beach"); this normalizes them.
 *
 * Safety:
 *  - Only touches is_active = true clinics.
 *  - The natural key is clinics(business_id, slug). Before changing a slug we
 *    check no OTHER clinic in the same business already holds the target slug
 *    (active or inactive). On conflict we append -2, -3, … and log it.
 *  - No redirects are created (per product decision): old URLs will 404.
 *
 * Pass --dry-run to preview without writing.
 */

import pool from "../src/lib/db";
import { slugify } from "../src/lib/scraper/utils";

const DRY_RUN = process.argv.includes("--dry-run");

async function uniqueSlug(base: string, businessId: string, selfId: string): Promise<string> {
  let slug = base || "clinic";
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM clinics WHERE business_id = $1 AND slug = $2 AND id <> $3 LIMIT 1`,
      [businessId, slug, selfId]
    );
    if (rows.length === 0) return slug;
    slug = `${base}-${n++}`;
  }
}

async function main() {
  const { rows: clinics } = await pool.query<{
    id: string;
    name: string;
    slug: string;
    business_id: string;
  }>(
    `SELECT id, name, slug, business_id FROM clinics WHERE is_active = true ORDER BY name`
  );

  let changed = 0;
  let unchanged = 0;
  for (const c of clinics) {
    const base = slugify(c.name);
    if (!base) {
      console.log(`⚠️  ${c.name} → empty slug, skipped`);
      continue;
    }
    const target = await uniqueSlug(base, c.business_id, c.id);
    if (target === c.slug) {
      unchanged++;
      continue;
    }
    const suffixed = target !== base ? "  (⚠ suffixed to avoid per-business conflict)" : "";
    console.log(`${DRY_RUN ? "[dry] " : ""}${c.name}: ${c.slug} → ${target}${suffixed}`);
    if (!DRY_RUN) {
      await pool.query(`UPDATE clinics SET slug = $2, updated_at = NOW() WHERE id = $1`, [
        c.id,
        target,
      ]);
    }
    changed++;
  }

  console.log(`\n${DRY_RUN ? "[dry-run] would change" : "changed"}: ${changed}, unchanged: ${unchanged}, total active: ${clinics.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
