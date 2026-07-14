import pool from "../src/lib/db";
import { ingestClinicByDomain } from "../src/lib/ingest/ingest-clinic";
import { ingestServicesByDomain } from "../src/lib/ingest/ingest-services";
import { ingestConcernsByDomain } from "../src/lib/ingest/ingest-concerns";

const svcCount = async () => {
  const r = await pool.query(
    `SELECT COUNT(*)::int n FROM clinic_services cs JOIN clinics c ON c.id=cs.clinic_id
      WHERE c.slug='ruma-medical' AND cs.is_active`
  );
  return r.rows[0].n as number;
};
const conCount = async () => {
  const r = await pool.query(
    `SELECT COUNT(*)::int n FROM clinic_concerns cc JOIN clinics c ON c.id=cc.clinic_id
      WHERE c.slug='ruma-medical' AND cc.is_active`
  );
  return r.rows[0].n as number;
};

console.log("=== BASELINE ===");
console.log("services:", await svcCount(), "concerns:", await conCount());

console.log("\n=== STEP 1: ingestClinicByDomain (DETAILS ONLY) ===");
const detailsResult = await ingestClinicByDomain("ruma.com");
console.log(JSON.stringify(detailsResult, null, 2));
console.log("services after DETAILS-ONLY refresh (must be UNCHANGED):", await svcCount());

console.log("\n=== STEP 2: ingestServicesByDomain (TREATMENTS ONLY) ===");
const servicesResult = await ingestServicesByDomain("ruma.com");
console.log(JSON.stringify(servicesResult, null, 2));
console.log("services after TREATMENTS refresh:", await svcCount());

console.log("\n=== STEP 3: ingestConcernsByDomain (CONCERNS ONLY, depends on services) ===");
const concernsResult = await ingestConcernsByDomain("ruma.com");
console.log("status:", concernsResult.status, "accepted:", concernsResult.concerns.length, "rejected:", concernsResult.rejected.length);
console.log("concerns after refresh:", await conCount());

await pool.end();
