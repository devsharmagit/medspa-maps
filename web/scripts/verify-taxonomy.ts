/**
 * verify-taxonomy.ts — run with: bun scripts/verify-taxonomy.ts
 *
 * Read-only verification of the canonical `services` taxonomy in the DB.
 * Checks:
 *   1. total count + that names are clean (no ®/™ glyphs) and lists all names
 *   2. Botox AND Dysport both exist as separate services
 *   3. every service has review_status='approved' and rows whose aliases
 *      absorbed variants carry a non-empty aliases array
 *
 * Does NOT mutate anything.
 */

import pool from "../src/lib/db";

interface ServiceRow {
  name: string;
  slug: string;
  category: string | null;
  aliases: string[] | null;
  review_status: string | null;
  is_active: boolean;
  is_published: boolean | null;
}

async function verify() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<ServiceRow>(
      `
      SELECT name, slug, category, aliases, review_status, is_active, is_published
      FROM services
      ORDER BY name
      `
    );

    console.log(`TOTAL services: ${rows.length}`);
    console.log("");
    console.log("=== ALL SERVICE NAMES ===");
    for (const r of rows) {
      const aliasCount = Array.isArray(r.aliases) ? r.aliases.length : 0;
      console.log(
        `  ${r.name}\t| slug=${r.slug}\t| cat=${r.category ?? "—"}\t| review=${r.review_status ?? "—"}\t| aliases=${aliasCount}`
      );
    }

    // ── 1. clean names: no ®/™ glyphs ─────────────────────────────────────
    const dirty = rows.filter((r) => /[®™]/.test(r.name));
    console.log("");
    console.log(`=== DIRTY GLYPHS (®/™) in names: ${dirty.length} ===`);
    for (const r of dirty) console.log(`  ⚠ "${r.name}"`);

    // ── 1b. obvious duplicate variants ────────────────────────────────────
    // Flag names that look like merge candidates (contain " / ", " and ",
    // " & ", or where one name is a prefix of another).
    console.log("");
    console.log("=== POSSIBLE DUP/VARIANT NAMES ===");
    const variantish = rows.filter((r) =>
      /\s\/\s|\sand\s|\s&\s/i.test(r.name)
    );
    for (const r of variantish) console.log(`  ? "${r.name}"`);

    const names = rows.map((r) => r.name);
    const prefixDups: string[] = [];
    for (const a of names) {
      for (const b of names) {
        if (a !== b && b.toLowerCase().startsWith(a.toLowerCase() + " ")) {
          prefixDups.push(`"${a}" is a prefix of "${b}"`);
        }
      }
    }
    console.log(`  prefix overlaps: ${prefixDups.length}`);
    for (const p of prefixDups) console.log(`    ? ${p}`);

    // ── 1c. duplicate slugs / names ───────────────────────────────────────
    const slugCounts = new Map<string, number>();
    const nameCounts = new Map<string, number>();
    for (const r of rows) {
      slugCounts.set(r.slug, (slugCounts.get(r.slug) ?? 0) + 1);
      nameCounts.set(r.name, (nameCounts.get(r.name) ?? 0) + 1);
    }
    const dupSlugs = [...slugCounts].filter(([, c]) => c > 1);
    const dupNames = [...nameCounts].filter(([, c]) => c > 1);
    console.log("");
    console.log(`=== EXACT DUPLICATE slugs: ${dupSlugs.length}, names: ${dupNames.length} ===`);
    for (const [s, c] of dupSlugs) console.log(`  ⚠ slug "${s}" x${c}`);
    for (const [n, c] of dupNames) console.log(`  ⚠ name "${n}" x${c}`);

    // ── 2. Botox + Dysport separate ───────────────────────────────────────
    const botox = rows.filter((r) => /^botox$/i.test(r.name) || r.slug === "botox");
    const dysport = rows.filter((r) => /^dysport$/i.test(r.name) || r.slug === "dysport");
    console.log("");
    console.log("=== BOTOX / DYSPORT ===");
    console.log(`  Botox rows: ${botox.length} ${botox.map((b) => `(${b.name}/${b.slug})`).join(" ")}`);
    console.log(`  Dysport rows: ${dysport.length} ${dysport.map((d) => `(${d.name}/${d.slug})`).join(" ")}`);

    // ── 3. review_status + aliases ────────────────────────────────────────
    const notApproved = rows.filter((r) => r.review_status !== "approved");
    console.log("");
    console.log(`=== review_status != 'approved': ${notApproved.length} ===`);
    for (const r of notApproved)
      console.log(`  ⚠ "${r.name}" → review_status=${r.review_status ?? "NULL"}`);

    const noAliases = rows.filter(
      (r) => !Array.isArray(r.aliases) || r.aliases.length === 0
    );
    console.log("");
    console.log(`=== rows with EMPTY aliases: ${noAliases.length} ===`);
    for (const r of noAliases) console.log(`  "${r.name}" (slug=${r.slug})`);
  } finally {
    client.release();
    await pool.end();
  }
}

verify();
