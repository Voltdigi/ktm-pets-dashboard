import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

function formatDate(dateStr: string, timeStr: string): string {
  // dateStr format: "2026-06-20", timeStr format: "Midday", "Morning", "Evening", etc.
  const [year, month, day] = dateStr.split("-");

  // Map time strings to hours (approximate)
  const timeMap: { [key: string]: string } = {
    "Early Morning": "06",
    "Morning": "09",
    "Late Morning": "11",
    "Midday": "12",
    "Afternoon": "14",
    "Late Afternoon": "16",
    "Evening": "18",
    "Night": "20",
  };

  const hour = timeMap[timeStr] || "10";
  return `${year}${month}${day}T${hour}0000Z`;
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

async function getPetsForClient(base: any, clientId: string): Promise<string[]> {
  try {
    const tableId = process.env.NEXT_PUBLIC_PETS_TABLE_ID;
    if (!tableId) return [];

    const records = await base
      .table(tableId)
      .select({
        filterByFormula: `{Client ID} = "${clientId}"`,
      })
      .all();

    return records
      .map((r) => r.fields["Pet Name"] as string)
      .filter(Boolean);
  } catch (error) {
    console.error(`Error fetching pets for client ${clientId}:`, error);
    return [];
  }
}

async function getConfirmedBookings(base: any) {
  try {
    const tableId = process.env.NEXT_PUBLIC_CONFIRMED_BOOKINGS_TABLE_ID;
    if (!tableId) throw new Error("Missing CONFIRMED_BOOKINGS_TABLE_ID");

    const records = await base.table(tableId).select().all();
    return records;
  } catch (error) {
    console.error("Error fetching confirmed bookings:", error);
    return [];
  }
}

function generateICS(events: Array<{
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  description: string;
  location: string;
}>) {
  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KTM Pets Dashboard//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

  for (const event of events) {
    ics += `BEGIN:VEVENT
UID:${event.uid}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z
DTSTART:${event.dtstart}
DTEND:${event.dtend}
SUMMARY:${event.summary}
DESCRIPTION:${event.description}
LOCATION:${event.location}
END:VEVENT
`;
  }

  ics += `END:VCALENDAR`;
  return ics;
}

export async function GET(request: NextRequest) {
  try {
    const baseId = process.env.NEXT_PUBLIC_BASE_ID;
    if (!baseId) {
      throw new Error("Missing NEXT_PUBLIC_BASE_ID");
    }

    const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
    const base = airtable.base(baseId);

    const bookings = await getConfirmedBookings(base);
    const events = [];

    for (const booking of bookings) {
      const fields = booking.fields as Record<string, any>;
      const requestIds = fields["Request ID"];

      if (!requestIds || requestIds.length === 0) continue;

      const serviceRequest = await getServiceRequest(base, requestIds[0]);
      if (!serviceRequest) continue;

      const srFields = serviceRequest.fields as Record<string, any>;
      const clientName = srFields["Client Name"] || "Unknown Client";
      const clientEmail = srFields["Email"] || "";
      const clientPhone = srFields["Phone Number"] || "";
      const serviceType = fields["Service Type"] || "";
      const duration = fields["Duration"] || "";
      const date = fields["Date"] as string;
      const time = fields["Time"] || "";
      const clientId = srFields["Client ID"];

      // Get pets for this client
      const pets = clientId ? await getPetsForClient(base, clientId) : [];
      const petNames = pets.length > 0 ? pets.join(", ") : "N/A";

      // Format address
      const address = formatAddress(srFields);

      // Generate unique ID
      const uid = `${booking.id}-${clientId}@ktmpets.com`;

      // Format summary
      const summary = `${serviceType} - ${petNames} (${duration})`;

      // Format description with all details
      const description = `Client: ${clientName}
Phone: ${clientPhone}
Email: ${clientEmail}
Service: ${serviceType}
Duration: ${duration}
Pets: ${petNames}`.replace(/\n/g, "\\n");

      // Calculate end time (assuming duration is in hours like "2 hours")
      const dtstart = formatDate(date, time);
      let dtend = dtstart;

      if (duration) {
        const match = duration.match(/(\d+)/);
        if (match) {
          const hours = parseInt(match[1]);
          const dateObj = new Date(
            `${date}T${dtstart.substring(9, 11)}:00:00Z`
          );
          dateObj.setHours(dateObj.getHours() + hours);
          dtend = dateObj
            .toISOString()
            .replace(/[-:]/g, "")
            .split(".")[0] + "Z";
        }
      }

      events.push({
        uid,
        summary,
        dtstart,
        dtend,
        description,
        location: address,
      });
    }

    const ics = generateICS(events);

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=bookings.ics",
      },
    });
  } catch (error) {
    console.error("Error generating calendar file:", error);
    return NextResponse.json(
      { error: "Failed to generate calendar file", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
