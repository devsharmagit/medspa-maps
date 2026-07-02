import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getServerSession } from "next-auth";

export async function GET() {
  try {
    // Check if user is authenticated (you can add admin role check here)
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await pool.query(
      `SELECT 
        id, full_name, business_email, business_name, phone, message,
        status, notes, created_at, updated_at, contacted_at
       FROM medspa_leads
       WHERE is_active = true
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ leads: result.rows });
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
