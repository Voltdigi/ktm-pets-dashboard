import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import {
  createOrGetSquareCustomer,
  createDepositInvoice,
  createBalanceInvoice,
  publishInvoice,
} from "../utils";

interface ServiceRequestFields {
  [key: string]: any;
  "Client Name": string;
  "Email": string;
  "Deposit Amount": number;
  Description?: string;
}

async function getAirtableBase() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.NEXT_PUBLIC_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Missing Airtable credentials");
  }

  const airtable = new Airtable({ apiKey });
  return airtable.base(baseId);
}

async function getServiceRequest(recordId: string) {
  const tableId = process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID;
  if (!tableId) {
    throw new Error("Missing SERVICE_REQUESTS_TABLE_ID");
  }

  const base = await getAirtableBase();
  const record = await base.table(tableId).find(recordId);
  return record;
}

async function updateServiceRequestStatus(recordId: string, newStatus: string, updates?: Record<string, any>) {
  const tableId = process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID;
  if (!tableId) {
    throw new Error("Missing SERVICE_REQUESTS_TABLE_ID");
  }

  const base = await getAirtableBase();
  const fields: Record<string, any> = {
    Status: newStatus,
    ...updates,
  };

  const record = await base.table(tableId).update(recordId, fields);
  return record;
}

export async function POST(request: NextRequest) {
  try {
    const { recordId, newStatus } = await request.json();

    console.log("=== UPDATE SERVICE REQUEST ===");
    console.log("Record ID:", recordId);
    console.log("New Status:", newStatus);

    if (!recordId || !newStatus) {
      return NextResponse.json(
        { error: "Missing recordId or newStatus" },
        { status: 400 }
      );
    }

    // Get current service request
    const record = await getServiceRequest(recordId);
    const fields = record.fields as ServiceRequestFields;
    const currentStatus = fields["Status"];

    // If changing to "Payment Pending", create invoices
    if (newStatus === "Payment Pending") {
      const clientName = fields["Client Name"];
      const clientEmail = fields["Email"];
      const depositAmount = fields["Deposit Amount"];
      const totalPrice = fields["Total Price"] || 0;
      const balanceAmount = totalPrice - depositAmount;
      const description = fields.Description || fields["Service Type"] || "Service";

      if (!clientName || !clientEmail) {
        console.error("Missing required fields for invoice creation");
        console.error("Client Name present?", !!clientName);
        console.error("Email present?", !!clientEmail);
        return NextResponse.json(
          {
            error: "Missing Client Name or Email in service request",
            debug: {
              clientNameValue: clientName,
              emailValue: clientEmail,
              allFields: Object.keys(fields)
            }
          },
          { status: 400 }
        );
      }

      if (!depositAmount || depositAmount <= 0) {
        return NextResponse.json(
          { error: "Deposit Amount must be greater than 0" },
          { status: 400 }
        );
      }

      if (!depositAmount) {
        return NextResponse.json(
          { error: "Missing deposit amount in service request" },
          { status: 400 }
        );
      }

      try {
        // Create or fetch Square customer
        const customer = await createOrGetSquareCustomer(clientEmail, clientName);

        if (!customer.id) {
          throw new Error("Failed to get/create Square customer");
        }

        // Create deposit invoice
        const depositInvoice = await createDepositInvoice({
          customerId: customer.id,
          customerEmail: clientEmail,
          clientName,
          depositAmount,
          description,
          serviceRequestId: recordId,
        });

        if (!depositInvoice.id || depositInvoice.version === undefined) {
          throw new Error("Failed to create deposit invoice");
        }

        // Publish deposit invoice
        await publishInvoice(depositInvoice.id, depositInvoice.version);

        // Create balance invoice
        const balanceInvoice = await createBalanceInvoice({
          customerId: customer.id,
          customerEmail: clientEmail,
          clientName,
          balanceAmount: balanceAmount || 0,
          description,
          serviceRequestId: recordId,
          daysUntilDue: 30,
        });

        if (!balanceInvoice.id) {
          throw new Error("Failed to create balance invoice");
        }

        // Update service request with new status and invoice IDs
        const updatedRecord = await updateServiceRequestStatus(recordId, newStatus, {
          "Square Customer ID": customer.id,
          "Square Deposit Invoice ID": depositInvoice.id,
          "Square Balance Invoice ID": balanceInvoice.id,
        });

        return NextResponse.json({
          success: true,
          message: "Status updated and invoices created",
          recordId,
          previousStatus: currentStatus,
          newStatus,
          invoices: {
            deposit: {
              id: depositInvoice.id,
              amount: depositAmount,
            },
            balance: {
              id: balanceInvoice.id,
              amount: balanceAmount || 0,
            },
          },
          customer: {
            id: customer.id,
            email: clientEmail,
          },
        });
      } catch (error) {
        console.error("Error in Payment Pending flow:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        return NextResponse.json(
          {
            success: false,
            error: errorMessage,
          },
          { status: 500 }
        );
      }
    }

    // For other status changes (like "Rejected"), just update the status
    const updatedRecord = await updateServiceRequestStatus(recordId, newStatus);

    return NextResponse.json({
      success: true,
      message: `Status updated to ${newStatus}`,
      recordId,
      previousStatus: currentStatus,
      newStatus,
    });
  } catch (error) {
    console.error("Error updating service request:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
