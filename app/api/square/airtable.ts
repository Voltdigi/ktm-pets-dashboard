import Airtable from "airtable";
import { parsePreferredDates } from "./utils";

// Initialize Airtable
export function getAirtableBase() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.NEXT_PUBLIC_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Missing Airtable credentials");
  }

  const airtable = new Airtable({ apiKey });
  return airtable.base(baseId);
}

// Get service requests table
export function getServiceRequestsTable() {
  const tableId = process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID;
  if (!tableId) {
    throw new Error("Missing SERVICE_REQUESTS_TABLE_ID");
  }
  return getAirtableBase().table(tableId);
}

// Fetch service request by ID
export async function getServiceRequest(recordId: string) {
  try {
    const record = await getServiceRequestsTable().find(recordId);
    return record;
  } catch (error) {
    console.error(`Error fetching service request ${recordId}:`, error);
    throw error;
  }
}

// Get all service requests with "Payment Pending" status
export async function getPendingPaymentRequests() {
  try {
    const records = await getServiceRequestsTable()
      .select({
        filterByFormula: "{Status} = 'Payment Pending'",
      })
      .all();

    return records;
  } catch (error) {
    console.error("Error fetching pending payment requests:", error);
    throw error;
  }
}

interface UpdateServiceRequestParams {
  status?: string;
  squareInvoiceId?: string;
  squareCustomerId?: string;
}

// Update service request with payment info
export async function updateServiceRequest(
  recordId: string,
  updates: UpdateServiceRequestParams
) {
  try {
    const fields: Record<string, any> = {};

    if (updates.status) fields["Status"] = updates.status;
    if (updates.squareInvoiceId)
      fields["Square Invoice ID"] = updates.squareInvoiceId;
    if (updates.squareCustomerId)
      fields["Square Customer ID"] = updates.squareCustomerId;

    const record = await getServiceRequestsTable().update(recordId, fields);
    return record;
  } catch (error) {
    console.error(`Error updating service request ${recordId}:`, error);
    throw error;
  }
}

// Get service request by Square Invoice ID
export async function findServiceRequestByInvoiceId(invoiceId: string) {
  try {
    const records = await getServiceRequestsTable()
      .select({
        filterByFormula: `{Square Invoice ID} = "${invoiceId}"`,
      })
      .all();

    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error(`Error finding service request by invoice ${invoiceId}:`, error);
    throw error;
  }
}

// Check if invoice already created for a service request (idempotency)
export async function hasInvoicesCreated(recordId: string): Promise<boolean> {
  try {
    const record = await getServiceRequest(recordId);
    const invoiceId = record.fields["Square Invoice ID"];

    return !!invoiceId;
  } catch (error) {
    console.error(
      `Error checking invoice status for ${recordId}:`,
      error
    );
    throw error;
  }
}

// Store invoice version for later reference (needed to publish invoices)
export async function storeInvoiceVersion(
  recordId: string,
  invoiceType: "deposit" | "balance",
  version: number
) {
  try {
    const field =
      invoiceType === "deposit"
        ? "Deposit Invoice Version"
        : "Balance Invoice Version";

    const fields: Record<string, any> = {};
    fields[field] = version;

    await getServiceRequestsTable().update(recordId, fields);
  } catch (error) {
    console.error(
      `Error storing ${invoiceType} invoice version:`,
      error
    );
    throw error;
  }
}

// Get confirmed bookings table
export function getConfirmedBookingsTable() {
  const tableId = process.env.NEXT_PUBLIC_CONFIRMED_BOOKINGS_TABLE_ID;
  if (!tableId) {
    throw new Error("Missing CONFIRMED_BOOKINGS_TABLE_ID");
  }
  return getAirtableBase().table(tableId);
}

// Check if bookings already exist for a service request
export async function hasConfirmedBookings(serviceRequestId: string): Promise<boolean> {
  try {
    const records = await getConfirmedBookingsTable().select().all();

    // Filter in code since linked record fields can't be queried with formula
    return records.some((record) => {
      const requestIds = record.fields["Request ID"];
      if (Array.isArray(requestIds)) {
        return requestIds.includes(serviceRequestId);
      }
      return requestIds === serviceRequestId;
    });
  } catch (error) {
    console.error(`Error checking for existing bookings:`, error);
    return false;
  }
}

// Create confirmed booking records from service request
export async function createConfirmedBookings(serviceRequest: any) {
  try {
    const fields = serviceRequest.fields as Record<string, any>;
    const raw = fields["Preferred Date and Time"];

    if (!raw) {
      console.warn(`No preferred dates found for service request ${serviceRequest.id}`);
      return;
    }

    // Check if bookings already exist (idempotency check for webhook retries)
    if (await hasConfirmedBookings(serviceRequest.id)) {
      console.log(`Bookings already exist for service request ${serviceRequest.id}, skipping creation`);
      return;
    }

    // Parse the JSON date structure
    const parsedDates = parsePreferredDates(raw);

    if (parsedDates.length === 0) {
      console.warn(`No standardised dates found. Raw value: ${raw}`);
      return;
    }

    console.log(`Parsed ${parsedDates.length} dates from Preferred Date and Time`);

    const duration = fields["Walk Duration"] || fields["Visit Duration"] || fields["Number of Nights"] || null;
    const table = getConfirmedBookingsTable();
    const serviceType = fields["Service Type"] || "";

    console.log(`Service Type: "${serviceType}"`);

    for (const parsed of parsedDates) {
      const bookingFields: Record<string, any> = {
        "Request ID": [serviceRequest.id],
        "Client Name": fields["Client Name"] || "",
        "Service Type": serviceType,
        "Date": parsed.isoDate,
        "Time": parsed.timePart,
      };

      // Only populate duration for dog walking and drop-in visits, not pet sitting
      if (!serviceType.includes("Sitting")) {
        bookingFields["Duration"] = duration ? String(duration) : "";
        console.log(`Added Duration: ${duration}`);
      } else {
        console.log(`Skipping Duration for Pet Sitting`);
      }

      await table.create(bookingFields);
    }

    console.log(`Created ${parsedDates.length} confirmed booking(s) for service request ${serviceRequest.id}`);
  } catch (error) {
    console.error("Error creating confirmed bookings:", error);
    throw error;
  }
}
