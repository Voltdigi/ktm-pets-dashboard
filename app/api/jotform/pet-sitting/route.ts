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

    // Extract pet sitting data with field mappings
    const petSittingData: Record<string, any> = {
      "Client Name": formatFullName(data.yourfull),
      "Number of Pets": parseInt(data.numberof, 10),
      "Number of Nights": parseInt(data.numberof43, 10),
      "Focus Area(s)": data.whatwould
        ? Array.isArray(data.whatwould)
          ? data.whatwould
          : Object.values(data.whatwould)
        : undefined,
      "Dates Required": data.preferreddates,
      "Phone Number": formatPhoneNumber(data.phonenumber),
      "First Line of Address": data.address?.addr_line1,
      Town: data.address?.city,
      "City / County": data.address?.state,
      Postcode: data.address?.postal,
      "Service Type": data.servicetype,
      "Submitted Date": `${data.date?.year}-${String(data.date?.month).padStart(2, "0")}-${String(data.date?.day).padStart(2, "0")}`,
      "Preferred Date and Time": data.preferreddates,
      Email: data.email,
      "Pet Species (1)": data.typea50,
      "Pet Species (2)": data.species2,
    };

    // Remove empty values
    Object.keys(petSittingData).forEach(
      (key) => !petSittingData[key] && delete petSittingData[key]
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

    console.log("Pet sitting data to be created:", petSittingData);

    // Create service request record
    const record = await base.table(serviceRequestsTableId).create([
      {
        fields: petSittingData,
      },
    ]);

    console.log(`Created pet sitting request: ${record[0].id}`);

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
