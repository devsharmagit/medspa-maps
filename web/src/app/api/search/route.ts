import { NextRequest, NextResponse } from "next/server";
import { runSearch } from "@/lib/search/query";

// Thin HTTP wrapper over the shared search engine (src/lib/search/query.ts).
// The client-side filter/pagination/map fetches hit this; the /search PAGE
// calls the same engine in-process to server-render the first result page.
export async function GET(request: NextRequest) {
  try {
    const payload = await runSearch(request.nextUrl.searchParams);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Failed to search clinics" },
      { status: 500 }
    );
  }
}
