import { NextResponse } from "next/server";
import { getCachedTableForCalendar } from "@/lib/airtable";
import {
  buildPetsByClientId,
  buildById,
  getClientIdFromServiceRequest,
} from "@/lib/airtable-joins";
import { formatAddress } from "@/lib/service-request-formatting";

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

export async function GET() {
  try {
    // Fetch all 3 tables once via the cached layer.
    // This is O(3) Airtable calls, regardless of how many bookings exist.
    const [bookings, serviceRequests, pets] = await Promise.all([
      getCachedTableForCalendar("bookings"),
      getCachedTableForCalendar("serviceRequests"),
      getCachedTableForCalendar("pets"),
    ]);

    // Build lookup maps for O(1) joins.
    const serviceRequestsById = buildById(serviceRequests);
    const petsByClientIdMap = buildPetsByClientId(pets);

    const events = [];

    // Loop over bookings, joining data from the already-loaded tables.
    // No per-booking Airtable calls at all — everything is in-memory.
    for (const booking of bookings) {
      const fields = booking.fields as Record<string, any>;
      const requestIds = fields["Request ID"];

      if (!requestIds || requestIds.length === 0) continue;

      const serviceRequest = serviceRequestsById.get(requestIds[0]);
      if (!serviceRequest) continue;

      const srFields = serviceRequest.fields as Record<string, any>;

      const clientName = srFields["Client Name"] || "Unknown Client";
      const clientEmail = srFields["Email"] || "";
      const clientPhone = srFields["Phone Number"] || "";
      const serviceType = fields["Service Type"] || "";
      const duration = fields["Duration"] || "";
      const date = fields["Date"] as string;
      const time = fields["Time"] || "";

      // Get client ID from service request and resolve pet names.
      const clientId = getClientIdFromServiceRequest(srFields);
      const petNames = clientId
        ? (petsByClientIdMap.get(clientId) ?? []).join(", ")
        : "N/A";

      // Format address from service request fields.
      const address = formatAddress(srFields);

      // Generate unique ID
      const uid = `${booking.id}-${clientId}@ktmpets.com`;

      // Format summary
      const summary = duration
        ? `${serviceType} - ${petNames} (${duration})`
        : `${serviceType} - ${petNames}`;

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
          const dateObj = new Date(`${date}T${dtstart.substring(9, 11)}:00:00Z`);
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
        // Cache the response so repeated calendar-app polls
        // don't even need to invoke this function for 30 min.
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("Error generating calendar file:", error);
    return NextResponse.json(
      {
        error: "Failed to generate calendar file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
