import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    // Prefer active canonical services; fall back to distinct raw names
    // only when no service catalog exists.
    const canonical = await pool.query(
      `SELECT id, name, slug
         FROM services
        WHERE is_active = TRUE
          AND name !~* '(dentistry|dental|orthodont|veneer)'
        ORDER BY name`
    );

    if (canonical.rows.length > 0) {
      const uniqueServices = Array.from(new Map(canonical.rows.map(s => [s.slug, s])).values());
      return NextResponse.json({ services: uniqueServices });
    }

    // No canonical services yet — derive from scraped raw names
    const raw = await pool.query(
      `SELECT DISTINCT
         raw_name                           AS name,
         slugify(raw_name)                  AS slug
       FROM clinic_services
       WHERE is_active = TRUE
         AND service_id IS NULL
         AND length(raw_name) BETWEEN 3 AND 60
         AND raw_name ~ '^[A-Za-z]'
       ORDER BY raw_name`
    );

    const uniqueRawServices = Array.from(new Map(raw.rows.map(s => [s.slug, s])).values());
    return NextResponse.json({ services: uniqueRawServices });
  } catch (error) {
    console.error("Services API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}
