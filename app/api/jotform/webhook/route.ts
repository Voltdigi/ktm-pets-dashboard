import Airtable from "airtable";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Verify JotForm webhook signature
function verifyJotFormSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!process.env.JOTFORM_WEBHOOK_TOKEN || !signature) {
    console.warn("Webhook token or signature missing");
    return false;
  }

  const hash = crypto
    .createHmac("sha256", process.env.JOTFORM_WEBHOOK_TOKEN)
    .update(payload)
    .digest("hex");

  return hash === signature;
}

// Format date from JotForm structure to YYYY-MM-DD
function formatDate(dateObj: any): string | null {
  if (!dateObj) return null;
  const { day, month, year } = dateObj;
  if (!day || !month || !year) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

// Combine first and last names
function formatFullName(nameObj: any): string {
  if (!nameObj) return "";
  const first = nameObj.first || "";
  const last = nameObj.last || "";
  return `${first} ${last}`.trim();
}

// Format phone number
function formatPhoneNumber(phoneObj: any): string {
  if (!phoneObj) return "";
  const area = phoneObj.area || "";
  const phone = phoneObj.phone || "";
  return `${area}${phone}`;
}

// Convert bracket notation to nested objects
// e.g., 'name[first]' -> data.name.first
function convertBracketNotation(flatData: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  Object.entries(flatData).forEach(([key, value]) => {
    const bracketMatch = key.match(/^(\w+)\[(\w+)\]$/);

    if (bracketMatch) {
      const [, parent, child] = bracketMatch;
      if (!result[parent]) result[parent] = {};
      result[parent][child] = value;
    } else {
      result[key] = value;
    }
  });

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-jotform-signature");

    // Verify signature
    // if (!verifyJotFormSignature(rawBody, signature)) {
    //    console.warn("Invalid JotForm signature");
    //    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    //  }

    // Parse form-encoded data from JotForm
    const params = new URLSearchParams(rawBody);
    const flatData: Record<string, any> = {};

    // Convert URLSearchParams to object
    params.forEach((value, key) => {
      flatData[key] = value;
    });

    // Convert bracket notation to nested objects
    const data = convertBracketNotation(flatData);

    console.log("Parsed JotForm data:", data);

    // Extract client data
    const clientData: Record<string, any> = {
      "Full Name": formatFullName(data.name),
      Email: data.email,
      "Phone Number": formatPhoneNumber(data.phonenumber),
      "First Line of Address": data.address?.addr_line1,
      "Town / City": data.address?.city,
      County: data.address?.state,
      Postcode: data.address?.postal,
      "Instagram Handle": data.instagramhandle,
      "Emergency Contact Name (1)": formatFullName(data.emergencycontact),
      "Emergency Contact Number (1)": formatPhoneNumber(
        data.emergencycontact10
      ),
      "Emergency Contact (2)": formatFullName(data.emergencycontact11),
      "Emergency Contact Number (2)": formatPhoneNumber(
        data.emergencycontact12
      ),
      "Emergency Vet Name": data.emergencyvet,
      "Emergency Vet Phone": formatPhoneNumber(data.emergencyvet14),
      "Consent for Emergency Veterinary Care?": data.inthe,
      "Maximum Authorised Vet Spend": data.pleasespecify,
      "Location of Emergency Equipment": data.locationof,
    };

    // Remove empty values
    Object.keys(clientData).forEach(
      (key) => !clientData[key] && delete clientData[key]
    );

    const baseId = process.env.NEXT_PUBLIC_BASE_ID;
    const clientsTableId = process.env.NEXT_PUBLIC_CLIENTS_TABLE_ID;
    const petsTableId = process.env.NEXT_PUBLIC_PETS_TABLE_ID;
    const apiKey = process.env.AIRTABLE_API_KEY;

    if (!baseId || !clientsTableId || !petsTableId || !apiKey) {
      throw new Error("Missing Airtable configuration");
    }

    // Initialize Airtable
    const airtable = new Airtable({ apiKey });
    const base = airtable.base(baseId);

    console.log("All JotForm fields received:", Object.keys(data));
    console.log("Client data to be created:", clientData);

    // Create client record
    const clientRecord = await base.table(clientsTableId).create([
      {
        fields: clientData,
      },
    ]);

    console.log(`Created new client record: ${clientRecord[0].id}`);

    // Extract pet data
    const petData: Record<string, any> = {
      "Pet Name": formatFullName(data.petname),
      Species: data.species,
      Microchipped: data.microchipped,
      Birthday: formatDate(data.birthday),
      Sex: data.sex,
      "Neutered / Spayed": data.neutered,
      "Up To Date On Vaccinations?": data.upto,
      "Pet Personality": data.primarypersonality,
      "Additional Information": data.anyadditional,
      Client: [clientRecord[0].id], // Link to client
    };

    console.log("Pet data before cleanup:", petData);

    // Remove empty values
    Object.keys(petData).forEach(
      (key) =>
        (!petData[key] || (Array.isArray(petData[key]) && petData[key].length === 0)) &&
        delete petData[key]
    );

    console.log("Pet data after cleanup:", petData);
    console.log("Pet name value:", petData["Pet Name"]);

    // Create pet record
    if (petData["Pet Name"]) {
      const petRecord = await base.table(petsTableId).create([
        {
          fields: petData,
        },
      ]);
      console.log(`Created pet record: ${petRecord[0].id}`);
    } else {
      console.log("Skipping pet creation - no pet name");
    }

    return NextResponse.json({
      success: true,
      message: "Client and pet records created/updated successfully",
      clientId: clientRecord[0].id,
    });
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
