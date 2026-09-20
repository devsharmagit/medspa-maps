/**
 * capture-media.ts — backfill the image blob store: fetch + compress + store a
 * WebP fallback copy of every clinic image and provider headshot in Postgres, so
 * the public site never breaks when a source URL 404s.
 *
 *   # Neon (dev) — verify only (size-limited): featured + a small sample
 *   bun --env-file=.env scripts/capture-media.ts --featured
 *   bun --env-file=.env scripts/capture-media.ts --limit 50
 *
 *   # RDS (prod, through the SSH tunnel) — cover everything
 *   DATABASE_URL='postgres://…@localhost:<tunnel>/medspa' bun scripts/capture-media.ts --all
 *
 * Flags:
 *   --all                every active clinic
 *   --featured           only featured clinics
 *   --clinic <id>        a single clinic id
 *   --limit N            cap the number of clinics processed
 *   --concurrency N      images captured in parallel per clinic (default 4)
 *   --stale-days N       skip rows captured OK within N days (default 30)
 *   --force              recapture even fresh rows
 *   --include-inactive   also process is_active = false clinics
 *   --dry                list what would be processed; capture nothing
 *
 * Resume-safe + idempotent: an already-captured (ok) row is skipped unless --force,
 * and a source 404 never wipes an existing good blob.
 */
import { query } from "../src/lib/db";
import { captureClinic } from "../src/lib/media/blobs";

const argVal = (f: string): string | undefined => {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const has = (f: string) => process.argv.includes(f);

const ALL = has("--all");
const FEATURED = has("--featured");
const CLINIC = argVal("--clinic");
const LIMIT = argVal("--limit") ? Number(argVal("--limit")) : undefined;
const CONCURRENCY = argVal("--concurrency") ? Number(argVal("--concurrency")) : 4;
const STALE_DAYS = argVal("--stale-days") ? Number(argVal("--stale-days")) : 30;
const FORCE = has("--force");
const INCLUDE_INACTIVE = has("--include-inactive");
const DRY = has("--dry");

async function selectClinics(): Promise<{ id: string; name: string }[]> {
  if (CLINIC) {
    return query(`SELECT id, name FROM clinics WHERE id = $1`, [CLINIC]);
  }
  const where: string[] = [];
  if (!INCLUDE_INACTIVE) where.push("is_active = true");
  if (FEATURED) where.push("featured = true");
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limitSql = LIMIT ? `LIMIT ${LIMIT}` : "";
  return query(
    `SELECT id, name FROM clinics ${whereSql} ORDER BY featured DESC, created_at ${limitSql}`
  );
}

async function main() {
  if (!ALL && !FEATURED && !CLINIC && !LIMIT) {
    console.error(
      "Refusing to run with no scope. Pass one of --all / --featured / --clinic <id> / --limit N."
    );
    process.exit(1);
  }

  const clinics = await selectClinics();
  console.log(
    `Capturing media for ${clinics.length} clinic(s) — concurrency ${CONCURRENCY}, stale-days ${STALE_DAYS}${FORCE ? ", force" : ""}${DRY ? " (DRY RUN)" : ""}`
  );

  const totals = { ok: 0, too_big: 0, error: 0, skipped: 0 };
  let n = 0;

  for (const clinic of clinics) {
    n++;
    if (DRY) {
      const [img] = await query<{ c: number }>(
        `SELECT count(*)::int c FROM images WHERE entity_type='clinic' AND entity_id=$1 AND source_url IS NOT NULL AND source_url <> ''`,
        [clinic.id]
      );
      const [prov] = await query<{ c: number }>(
        `SELECT count(*)::int c FROM providers WHERE clinic_id=$1 AND image_url IS NOT NULL AND image_url <> ''`,
        [clinic.id]
      );
      console.log(`[${n}/${clinics.length}] ${clinic.name}: ${img.c} images + ${prov.c} providers`);
      continue;
    }

    try {
      const r = await captureClinic(clinic.id, {
        force: FORCE,
        staleDays: STALE_DAYS,
        concurrency: CONCURRENCY,
      });
      totals.ok += r.ok;
      totals.too_big += r.too_big;
      totals.error += r.error;
      totals.skipped += r.skipped;
      console.log(
        `[${n}/${clinics.length}] ${clinic.name}: ok ${r.ok}, skipped ${r.skipped}, too_big ${r.too_big}, error ${r.error}`
      );
    } catch (e) {
      console.error(`[${n}/${clinics.length}] ${clinic.name}: FAILED`, e instanceof Error ? e.message : e);
    }
  }

  if (!DRY) {
    console.log(
      `\nDone. Totals — ok ${totals.ok}, skipped ${totals.skipped}, too_big ${totals.too_big}, error ${totals.error}`
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
