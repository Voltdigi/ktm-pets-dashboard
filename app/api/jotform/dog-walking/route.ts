import Airtable from "airtable";
import { NextRequest, NextResponse } from "next/server";
import {
  convertBracketNotation,
  formatFullName,
  formatPhoneNumber,
} from "../utils";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Parse form-encoded data from JotForm
    const params = new URLSearchParams(rawBody);
    const flatData: Record<string, any> = {};

    params.forEach((value, key) => {
      flatData[key] = value;
    });

    // Convert bracket notation to nested objects
    const data = convertBracketNotation(flatData);

    console.log("Parsed JotForm data:", data);

    // Extract dog walking data with field mappings
    const dogWalkingData: Record<string, any> = {
      "Client Name": formatFullName(data.yourfull),
      "Number of Pets": parseInt(data.numberof, 10),
      "Walk Duration": data.walkduration,
      "Dates Required": data.preferreddays,
      "Dogs Can Walk Together?": data.canyour,
      "Walking Details": data.pleaseprovide,
      "Phone Number": formatPhoneNumber(data.phonenumber),
      "First Line of Address": data.address?.addr_line1,
      Town: data.address?.city,
      "City / County": data.address?.state,
      Postcode: data.address?.postal,
      "Service Type": data.typea42,
      "Submitted Date": `${data.date?.year}-${String(data.date?.month).padStart(2, "0")}-${String(data.date?.day).padStart(2, "0")}`,
      "Preferred Date and Time": data.preferreddays,
      Email: data.email,
    };

    // Remove empty values
    Object.keys(dogWalkingData).forEach(
      (key) => !dogWalkingData[key] && delete dogWalkingData[key]
    );

    const baseId = process.env.NEXT_PUBLIC_BASE_ID;
    const serviceRequestsTableId = process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID;
    const apiKey = process.env.AIRTABLE_API_KEY;

    if (!baseId || !serviceRequestsTableId || !apiKey) {
      throw new Error("Missing Airtable configuration");
    }

    // Initialize Airtable
    const airtable = new Airtable({ apiKey });
    const base = airtable.base(baseId);

    console.log("Dog walking data to be created:", dogWalkingData);

    // Create service request record
    const record = await base.table(serviceRequestsTableId).create([
      {
        fields: dogWalkingData,
      },
    ]);

    console.log(`Created dog walking request: ${record[0].id}`);

    return NextResponse.redirect("https://ktmpets.com/thanks", { status: 303 });
  } catch (error) {
    console.error("JotForm webhook error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
