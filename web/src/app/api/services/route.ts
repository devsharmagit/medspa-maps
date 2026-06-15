import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, name, slug FROM services WHERE is_active = TRUE ORDER BY display_order, name`
    );
    return NextResponse.json({ services: result.rows });
  } catch (error) {
    console.error("Services API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}
