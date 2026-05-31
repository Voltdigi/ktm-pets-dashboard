import Airtable from "airtable";

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
  squareDepositInvoiceId?: string;
  squareBalanceInvoiceId?: string;
  squareCustomerId?: string;
  webhookRequestId?: string;
}

// Update service request with payment info
export async function updateServiceRequest(
  recordId: string,
  updates: UpdateServiceRequestParams
) {
  try {
    const fields: Record<string, any> = {};

    if (updates.status) fields["Status"] = updates.status;
    if (updates.squareDepositInvoiceId)
      fields["Square Deposit Invoice ID"] = updates.squareDepositInvoiceId;
    if (updates.squareBalanceInvoiceId)
      fields["Square Balance Invoice ID"] = updates.squareBalanceInvoiceId;
    if (updates.squareCustomerId)
      fields["Square Customer ID"] = updates.squareCustomerId;
    if (updates.webhookRequestId)
      fields["Webhook Request ID"] = updates.webhookRequestId;

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
        filterByFormula: `OR({Square Deposit Invoice ID} = "${invoiceId}", {Square Balance Invoice ID} = "${invoiceId}")`,
      })
      .all();

    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error(`Error finding service request by invoice ${invoiceId}:`, error);
    throw error;
  }
}

// Check if invoices already created for a service request (idempotency)
export async function hasInvoicesCreated(recordId: string): Promise<boolean> {
  try {
    const record = await getServiceRequest(recordId);
    const depositInvoiceId =
      record.fields["Square Deposit Invoice ID"];
    const balanceInvoiceId =
      record.fields["Square Balance Invoice ID"];

    return !!(depositInvoiceId || balanceInvoiceId);
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
