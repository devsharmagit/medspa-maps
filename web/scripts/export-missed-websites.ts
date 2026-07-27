/**
 * export-missed-websites.ts — which harvested G99 websites are NOT in the directory.
 *
 * The answer previously lived only in two hand-maintained markdown tables
 * (SKIPPED-CLINICS.md, DUPLICATE-DOMAINS.md), which go stale the moment a clinic
 * is added. This script derives it from the live DB instead and uses those
 * markdown files only as a source of *reasons*, so the interesting rows — a
 * missing website nobody has triaged yet — fall out on their own.
 *
 * Re-runnable and read-only. Writes an .xlsx (one sheet per audience) plus a CSV
 * of the main sheet for quick diffing between runs.
 *
 *   bun run export:missed-websites
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import pool, { query } from "../src/lib/db";
import { websiteDomain } from "../src/lib/admin/clinic-save";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const OUT_DIR = resolve(REPO_ROOT, "web/reports");

/** Markdown tables to mine for "why wasn't this added?". */
const REASON_SOURCES = [
  {
    file: "SKIPPED-CLINICS.md",
    category: "Not a medspa / no usable data",
    /** Column index (0-based, after the leading pipe) holding the reason. */
    reasonCol: 2,
    /** Prefix so the cell reads as a reason on its own. */
    reasonPrefix: "",
  },
  {
    file: "DUPLICATE-DOMAINS.md",
    category: "Alternate domain of a clinic already in the DB",
    // Both tables in this file put a name/domain here ("Resolves to", "Business
    // name"), not prose — the prefix is what makes it a reason.
    reasonCol: 1,
    reasonPrefix: "Duplicate of: ",
  },
] as const;

interface G99Row {
  domain: string;
  website: string;
  business_name: string | null;
  clinic_name: string | null;
  specialization: string | null;
  clinic_count: number;
  g99_clinic_ids: string[] | null;
  /** slug of the clinic whose website is exactly this domain, else null */
  matched_slug: string | null;
  matched_name: string | null;
  /** slug matched only after dropping a subdomain (e.g. thespa.aestique.com → aestique.com) */
  base_match_slug: string | null;
}

interface OutRow extends G99Row {
  in_db: boolean;
  reason_not_added: string;
  reason_category: string;
}

/**
 * SQL-side normalisation of clinics.website to a bare host, mirroring
 * websiteDomain() in lib/admin/clinic-save.ts (strip scheme, strip www, drop
 * any path, lowercase) so this join matches how ingest dedupes.
 */
const NORM_WEBSITE = `split_part(
  lower(regexp_replace(regexp_replace(coalesce(c.website,''), '^https?://', ''), '^www\\.', '')),
  '/', 1)`;

/** "thespa.aestique.com" → "aestique.com"; leaves two-label domains alone. */
function baseDomain(domain: string): string {
  const parts = domain.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : domain;
}

async function loadG99Rows(): Promise<G99Row[]> {
  return query<G99Row>(`
    SELECT g.domain,
           g.website,
           g.business_name,
           g.clinic_name,
           g.specialization,
           g.clinic_count,
           g.g99_clinic_ids::text[] AS g99_clinic_ids,
           exact.slug   AS matched_slug,
           exact.name   AS matched_name,
           base.slug    AS base_match_slug
      FROM g99_clinic_websites g
      LEFT JOIN LATERAL (
        SELECT c.slug, c.name FROM clinics c
         WHERE ${NORM_WEBSITE} = lower(g.domain)
         ORDER BY c.is_active DESC, c.created_at
         LIMIT 1
      ) exact ON true
      LEFT JOIN LATERAL (
        SELECT c.slug FROM clinics c
         WHERE ${NORM_WEBSITE} = regexp_replace(lower(g.domain), '^[^.]+\\.(?=[^.]+\\.[^.]+$)', '')
         ORDER BY c.is_active DESC, c.created_at
         LIMIT 1
      ) base ON true
     ORDER BY g.domain
  `);
}

/**
 * Parse the markdown pipe-tables into domain → { reason, category }.
 * Tolerant by design: any row whose first cell looks like a domain counts, so
 * added sections and extra columns don't silently drop reasons.
 */
function loadReasons(): Map<string, { reason: string; category: string }> {
  const out = new Map<string, { reason: string; category: string }>();

  for (const src of REASON_SOURCES) {
    let text: string;
    try {
      text = readFileSync(resolve(REPO_ROOT, src.file), "utf8");
    } catch {
      console.warn(`  ! ${src.file} not found — reasons from it will be blank`);
      continue;
    }

    for (const line of text.split("\n")) {
      if (!line.trimStart().startsWith("|")) continue;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (!cells.length) continue;
      // Skip header + separator rows.
      if (/^-{2,}$/.test(cells[0].replace(/[:\s]/g, ""))) continue;
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cells[0])) continue;

      const domain = websiteDomain(cells[0]);
      const cell = cells[src.reasonCol] ?? "";
      const reason = cell ? `${src.reasonPrefix}${cell}` : "";
      // First source wins: an explicit "not a medspa" beats "duplicate".
      if (!out.has(domain)) out.set(domain, { reason, category: src.category });
    }
  }

  return out;
}

function decorate(
  rows: G99Row[],
  reasons: Map<string, { reason: string; category: string }>
): OutRow[] {
  return rows.map((r) => {
    const domain = r.domain.toLowerCase();
    const documented = reasons.get(domain) ?? reasons.get(baseDomain(domain));
    const in_db = r.matched_slug != null;
    return {
      ...r,
      in_db,
      reason_not_added: in_db ? "" : documented?.reason ?? "",
      reason_category: in_db
        ? ""
        : documented?.category ??
          (r.base_match_slug
            ? "Subdomain of a clinic already in the DB — verify"
            : "NEEDS TRIAGE — no recorded reason"),
    };
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Workbook
// ──────────────────────────────────────────────────────────────────────────
interface Column {
  header: string;
  key: keyof OutRow | "g99_ids";
  width: number;
}

const COLUMNS: Column[] = [
  { header: "Domain", key: "domain", width: 34 },
  { header: "Website", key: "website", width: 40 },
  { header: "Business name (G99)", key: "business_name", width: 32 },
  { header: "Clinic name (G99)", key: "clinic_name", width: 32 },
  { header: "Specialization", key: "specialization", width: 22 },
  { header: "Reason not added", key: "reason_not_added", width: 60 },
  { header: "Category", key: "reason_category", width: 42 },
  { header: "Possible base-domain match", key: "base_match_slug", width: 26 },
  { header: "G99 clinic rows", key: "clinic_count", width: 14 },
  { header: "G99 clinic ids", key: "g99_ids", width: 24 },
];

function cellValues(r: OutRow): (string | number)[] {
  return COLUMNS.map((c) => {
    if (c.key === "g99_ids") return (r.g99_clinic_ids ?? []).join(", ");
    const v = r[c.key as keyof OutRow];
    if (v == null) return "";
    return typeof v === "number" ? v : String(v);
  });
}

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  note: string,
  rows: OutRow[]
) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  const noteRow = ws.addRow([`${note}  —  ${rows.length} row(s)`]);
  noteRow.font = { italic: true, color: { argb: "FF666666" } };
  ws.mergeCells(1, 1, 1, COLUMNS.length);

  const header = ws.addRow(COLUMNS.map((c) => c.header));
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3E6EE" },
  };

  for (const r of rows) ws.addRow(cellValues(r));

  ws.columns.forEach((col, i) => {
    col.width = COLUMNS[i].width;
  });
  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2 + rows.length, column: COLUMNS.length },
  };
  // Reasons are long prose — wrap rather than spill across neighbours.
  ws.getColumn(COLUMNS.findIndex((c) => c.key === "reason_not_added") + 1).alignment =
    { wrapText: true, vertical: "top" };
}

function toCsv(rows: OutRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    COLUMNS.map((c) => esc(c.header)).join(","),
    ...rows.map((r) => cellValues(r).map(esc).join(",")),
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────────────────
async function main() {
  const stampArg = process.argv.find((a) => a.startsWith("--date="));
  const stamp = stampArg
    ? stampArg.slice("--date=".length)
    : new Date().toISOString().slice(0, 10);

  console.log("→ reading g99_clinic_websites + clinics …");
  const g99 = await loadG99Rows();
  const reasons = loadReasons();
  const all = decorate(g99, reasons);

  const missing = all.filter((r) => !r.in_db);
  const needsTriage = missing.filter((r) => !r.reason_not_added);
  const skipped = missing.filter(
    (r) => r.reason_category === REASON_SOURCES[0].category
  );
  const duplicates = missing.filter(
    (r) => r.reason_category === REASON_SOURCES[1].category
  );

  console.log(`  G99 websites harvested : ${all.length}`);
  console.log(`  already in the DB      : ${all.length - missing.length}`);
  console.log(`  NOT in the DB          : ${missing.length}`);
  console.log(`    ├─ needs triage      : ${needsTriage.length}`);
  console.log(`    ├─ not a medspa      : ${skipped.length}`);
  console.log(`    └─ alternate domain  : ${duplicates.length}`);

  const wb = new ExcelJS.Workbook();
  wb.creator = "medspa-map / export-missed-websites";
  wb.created = new Date();

  addSheet(
    wb,
    "Needs triage",
    "Harvested G99 websites with NO clinic row and no recorded reason — decide: add, or document why not.",
    needsTriage
  );
  addSheet(
    wb,
    "Not in DB",
    "Every harvested G99 website with no matching clinic row, whatever the reason.",
    missing
  );
  addSheet(
    wb,
    "Skipped (reason known)",
    "Evaluated and deliberately not added: not a medical spa, or the site had no usable data.",
    skipped
  );
  addSheet(
    wb,
    "Duplicates",
    "Alternate G99 domains for a business already in the DB under another domain.",
    duplicates
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const xlsxPath = resolve(OUT_DIR, `missed-websites-${stamp}.xlsx`);
  const csvPath = resolve(OUT_DIR, `missed-websites-${stamp}.csv`);
  await wb.xlsx.writeFile(xlsxPath);
  writeFileSync(csvPath, toCsv(missing), "utf8");

  console.log(`\n✓ ${xlsxPath.replace(REPO_ROOT + "/", "")}`);
  console.log(`✓ ${csvPath.replace(REPO_ROOT + "/", "")} (Not in DB sheet)`);

  if (needsTriage.length) {
    console.log(`\n${needsTriage.length} website(s) need a decision:`);
    for (const r of needsTriage) {
      console.log(
        `  • ${r.domain}${r.business_name ? ` — ${r.business_name.trim()}` : ""}` +
          (r.base_match_slug ? `  [possible dupe of /${r.base_match_slug}]` : "")
      );
    }
  }
}

main()
  .catch((err) => {
    console.error("export-missed-websites failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
