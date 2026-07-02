import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { z } from "zod";

const leadSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  business_email: z.string().email("Invalid email address"),
  business_name: z.string().min(2, "Business name must be at least 2 characters"),
  phone: z.string().optional(),
  message: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = leadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { full_name, business_email, business_name, phone, message } = validation.data;

    // Get IP and user agent for tracking
    const ip_address = request.headers.get("x-forwarded-for") || 
                       request.headers.get("x-real-ip") || 
                       "unknown";
    const user_agent = request.headers.get("user-agent") || "unknown";

    // Insert lead into database
    const result = await pool.query(
      `INSERT INTO medspa_leads 
        (full_name, business_email, business_name, phone, message, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [full_name, business_email, business_name, phone, message, ip_address, user_agent]
    );

    return NextResponse.json({
      success: true,
      message: "Thank you! We'll contact you soon.",
      lead_id: result.rows[0].id,
    });
  } catch (error) {
    console.error("Lead submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit form. Please try again." },
      { status: 500 }
    );
  }
}
