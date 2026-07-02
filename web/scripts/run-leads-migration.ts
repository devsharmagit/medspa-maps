import { readFileSync } from "fs";
import { join } from "path";
import pool from "../src/lib/db";

async function runMigration() {
  try {
    console.log("Running medspa_leads table migration...");
    
    const sql = readFileSync(
      join(__dirname, "create-leads-table.sql"),
      "utf-8"
    );
    
    await pool.query(sql);
    
    console.log("✅ Migration completed successfully!");
    console.log("   - Created medspa_leads table");
    console.log("   - Created indexes");
    console.log("   - Created update trigger");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
