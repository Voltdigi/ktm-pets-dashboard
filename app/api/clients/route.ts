import Airtable from "airtable";
import { NextRequest, NextResponse } from "next/server";

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
});

export async function GET(request: NextRequest) {
  try {
    const baseId = process.env.NEXT_PUBLIC_BASE_ID;
    const tableIdParam = request.nextUrl.searchParams.get("tableId");

    if (!baseId || !tableIdParam) {
      throw new Error("Missing Airtable credentials or table ID");
    }

    const base = airtable.base(baseId);
    const table = base.table(tableIdParam);

    const records = await table.select().all();

    return NextResponse.json({
      success: true,
      data: records.map((record: any) => ({
        id: record.id,
        fields: record.fields,
      })),
    });
  } catch (error) {
    console.error("Airtable error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
