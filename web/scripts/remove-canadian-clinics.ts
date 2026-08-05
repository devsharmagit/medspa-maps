/**
 * remove-canadian-clinics.ts — one-off hard delete of Canadian clinics that
 * slipped into the (US-only) directory. Mirrors the DELETE handler at
 * src/app/api/admin/clinics/[id]/route.ts (images cleanup + cascade).
 *
 *   bun scripts/remove-canadian-clinics.ts --dry   (preview, no writes)
 *   bun scripts/remove-canadian-clinics.ts         (execute)
 */
import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CANADIAN_CLINICS = [
  { id: "3a828606-de7c-4fd0-bd00-73b76b34ad9b", name: "Casa Beauty" },
  { id: "5f98f6bd-41a4-44d6-9a75-eeecbd773100", name: "Derma Bar" },
  { id: "603d7b4b-4d05-4668-aecf-2abeafd6bfb7", name: "Keraderm MedSpa" },
  { id: "e442b226-14ff-49f4-a947-2b7d64f294e3", name: "NURSE. Aesthetic & Holistic Clinic" },
  { id: "9f528b3b-8db9-4c21-96e5-de2626f8e022", name: "Renovo Medi Spa" },
  { id: "caa2c694-40ca-4778-bd3f-54e87b19f3a3", name: "Skin Logic Ottawa" },
  { id: "46ad6deb-ecc8-4d7a-b3ca-3794e924ed84", name: "Sunshine Cosmetic Clinic & Medi Spa" },
  { id: "3666c950-5710-4864-b9ad-bd7bf8a56b10", name: "Vertex Aesthetics" },
];

async function main() {
  const dry = process.argv.includes("--dry");
  console.log(dry ? "DRY RUN — no writes will happen\n" : "EXECUTING — deleting for real\n");

  for (const clinic of CANADIAN_CLINICS) {
    if (dry) {
      console.log(`would delete: ${clinic.name} (${clinic.id})`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM images WHERE entity_type = 'clinic' AND entity_id = $1", [clinic.id]);
      const res = await client.query("DELETE FROM clinics WHERE id = $1 RETURNING id, name", [clinic.id]);
      await client.query("COMMIT");
      console.log(res.rowCount ? `deleted: ${res.rows[0].name} (${res.rows[0].id})` : `NOT FOUND: ${clinic.name} (${clinic.id})`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`FAILED: ${clinic.name} (${clinic.id})`, e);
    } finally {
      client.release();
    }
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
