import { NextRequest, NextResponse } from "next/server";
import { getCachedTable, invalidateTable } from "@/lib/airtable";

// Map table IDs (from env) to our internal table key for the cache layer
function tableIdToKey(
  tableId: string
): "clients" | "pets" | "serviceRequests" | "bookings" {
  const tableMap: Record<string, "clients" | "pets" | "serviceRequests" | "bookings"> = {
    [process.env.NEXT_PUBLIC_CLIENTS_TABLE_ID || ""]: "clients",
    [process.env.NEXT_PUBLIC_PETS_TABLE_ID || ""]: "pets",
    [process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID || ""]: "serviceRequests",
    [process.env.NEXT_PUBLIC_CONFIRMED_BOOKINGS_TABLE_ID || ""]: "bookings",
  };
  const key = tableMap[tableId];
  if (!key) throw new Error(`Unknown table ID: ${tableId}`);
  return key;
}

export async function GET(request: NextRequest) {
  try {
    const tableIdParam = request.nextUrl.searchParams.get("tableId");
    const force = request.nextUrl.searchParams.get("force") === "1";

    if (!tableIdParam) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing table ID",
        },
        { status: 400 }
      );
    }

    const tableKey = tableIdToKey(tableIdParam);

    // If force=1, invalidate the cache first (used by manual refresh buttons).
    if (force) {
      await invalidateTable(tableKey);
    }

    // Fetch from the cached layer (or real Airtable if cache miss).
    const data = await getCachedTable(tableKey);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Airtable API error]:", errorMsg);
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
