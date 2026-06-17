import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    // Prefer canonical services table; fall back to distinct raw names from clinic_services
    const canonical = await pool.query(
      `SELECT id, name, slug FROM services WHERE is_active = TRUE ORDER BY name`
    );

    if (canonical.rows.length > 0) {
      return NextResponse.json({ services: canonical.rows });
    }

    // No canonical services yet — derive from scraped raw names
    const raw = await pool.query(
      `SELECT DISTINCT
         raw_name                           AS name,
         slugify(raw_name)                  AS slug
       FROM clinic_services
       WHERE is_active = TRUE
         AND length(raw_name) BETWEEN 3 AND 60
         AND raw_name ~ '^[A-Za-z]'
       ORDER BY raw_name`
    );

    return NextResponse.json({ services: raw.rows });
  } catch (error) {
    console.error("Services API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}
