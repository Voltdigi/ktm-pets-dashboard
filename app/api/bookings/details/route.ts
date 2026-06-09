import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

async function getServiceRequest(base: any, recordId: string) {
  try {
    const tableId = process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID;
    if (!tableId) throw new Error("Missing SERVICE_REQUESTS_TABLE_ID");

    const record = await base.table(tableId).find(recordId);
    return record;
  } catch (error) {
    console.error(`Error fetching service request ${recordId}:`, error);
    return null;
  }
}

async function getClient(base: any, clientId: string) {
  try {
    const tableId = process.env.NEXT_PUBLIC_CLIENTS_TABLE_ID;
    if (!tableId) return null;

    const record = await base.table(tableId).find(clientId);
    return record;
  } catch (error) {
    console.error(`Error fetching client ${clientId}:`, error);
    return null;
  }
}

async function getPetsForClient(base: any, clientId: string): Promise<string[]> {
  try {
    const tableId = process.env.NEXT_PUBLIC_PETS_TABLE_ID;
    if (!tableId) return [];

    const allPets = await base.table(tableId).select().all();
    const records = allPets.filter((pet: any) => {
      const petClientIds = pet.fields["Client"];
      if (Array.isArray(petClientIds)) {
        return petClientIds.includes(clientId);
      }
      return petClientIds === clientId;
    });

    return records
      .map((r: any) => r.fields["Pet Name"] as string)
      .filter(Boolean);
  } catch (error) {
    console.error(`Error fetching pets for client ${clientId}:`, error);
    return [];
  }
}

function formatAddress(addressFields: Record<string, any>): string {
  const parts = [
    addressFields["First Line of Address"],
    addressFields["Town"],
    addressFields["City / County"],
    addressFields["Postcode"],
  ].filter(Boolean);

  return parts.join(", ");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bookingId = body.bookingId;

    if (!bookingId) {
      return NextResponse.json(
        { error: "Missing bookingId" },
        { status: 400 }
      );
    }

    const baseId = process.env.NEXT_PUBLIC_BASE_ID;
    if (!baseId) {
      throw new Error("Missing NEXT_PUBLIC_BASE_ID");
    }

    const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
    const base = airtable.base(baseId);

    // Get the booking record
    const bookingsTableId = process.env.NEXT_PUBLIC_CONFIRMED_BOOKINGS_TABLE_ID;
    if (!bookingsTableId) throw new Error("Missing CONFIRMED_BOOKINGS_TABLE_ID");

    const booking = await base.table(bookingsTableId).find(bookingId);
    const bookingFields = booking.fields;

    // Get service request
    const requestIds = bookingFields["Request ID"];
    if (!requestIds || requestIds.length === 0) {
      return NextResponse.json(
        { booking: bookingFields },
        { status: 200 }
      );
    }

    const serviceRequest = await getServiceRequest(base, requestIds[0]);
    if (!serviceRequest) {
      return NextResponse.json(
        { booking: bookingFields },
        { status: 200 }
      );
    }

    const srFields = serviceRequest.fields;

    // Get client info
    const testClientsLinked = srFields["TEST_CLIENTS"];
    const clientId = Array.isArray(testClientsLinked) ? testClientsLinked[0] : testClientsLinked;

    let clientData = null;
    if (clientId) {
      clientData = await getClient(base, clientId);
    }

    // Get pets for this client
    const pets = clientId ? await getPetsForClient(base, clientId) : [];
    const petNames = pets.length > 0 ? pets.join(", ") : "N/A";

    // Format address
    const address = formatAddress(srFields);

    return NextResponse.json({
      booking: bookingFields,
      serviceRequest: srFields,
      client: clientData?.fields || null,
      pets: petNames,
      address,
    });
  } catch (error) {
    console.error("Error fetching booking details:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking details", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
