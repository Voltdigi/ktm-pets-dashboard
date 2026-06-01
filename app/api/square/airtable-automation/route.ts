import { NextRequest, NextResponse } from "next/server";
import {
  createOrGetSquareCustomer,
  createInvoice,
  publishInvoice,
} from "../utils";
import {
  updateServiceRequest,
  hasInvoicesCreated,
  getServiceRequest,
} from "../airtable";

interface ServiceRequestFields {
  [key: string]: any;
  "Client Name": string;
  "Email": string;
  "Deposit Amount": number;
  Description?: string;
}

async function processServiceRequest(recordId: string) {
  try {
    // Check if invoices already created (idempotency)
    const hasInvoices = await hasInvoicesCreated(recordId);
    if (hasInvoices) {
      console.log(
        `Invoices already created for service request ${recordId}, skipping`
      );
      return {
        status: "skipped",
        message: "Invoices already exist",
        recordId,
      };
    }

    // Get service request details
    const record = await getServiceRequest(recordId);
    const fields = record.fields as ServiceRequestFields;

    const clientName = fields["Client Name"];
    const clientEmail = fields["Email"];
    const depositAmount = fields["Deposit Amount"];
    const balanceAmount = (fields["Balance Amount"] || fields["Total Price"] || 0);
    const description = fields.Description || fields["Service Type"] || "Service";

    if (!clientName || !clientEmail) {
      throw new Error("Missing Client Name or Email");
    }

    if (!depositAmount || depositAmount <= 0) {
      throw new Error("Deposit Amount must be greater than 0");
    }

    if (!depositAmount) {
      throw new Error("Missing deposit amount");
    }

    console.log(
      `Processing payment for ${clientName} (${clientEmail}) - Deposit: $${depositAmount}, Balance: $${balanceAmount}`
    );

    // Create or fetch Square customer
    const customer = await createOrGetSquareCustomer(clientEmail, clientName);

    if (!customer.id) {
      throw new Error("Failed to get/create Square customer");
    }

    // Create single invoice with deposit and balance payment requests
    const invoice = await createInvoice({
      customerId: customer.id,
      customerEmail: clientEmail,
      clientName,
      depositAmount,
      balanceAmount: balanceAmount || 0,
      description,
      serviceRequestId: recordId,
    });

    if (!invoice.id || invoice.version === undefined) {
      throw new Error("Failed to create invoice");
    }

    // Publish invoice
    await publishInvoice(invoice.id, invoice.version);

    // Update Airtable with invoice information
    await updateServiceRequest(recordId, {
      squareCustomerId: customer.id,
      squareInvoiceId: invoice.id,
    });

    console.log(
      `Successfully created invoice for ${clientName}: ${invoice.id}`
    );

    return {
      status: "success",
      message: "Invoice created and published",
      recordId,
      customerId: customer.id,
      invoiceId: invoice.id,
    };
  } catch (error) {
    console.error(`Error processing service request ${recordId}:`, error);
    return {
      status: "error",
      recordId,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("Received Airtable automation payload:", JSON.stringify(body, null, 2));

    // Airtable automation sends the record ID in the payload
    // The exact field name depends on how you set up the automation
    // Common variations:
    const recordId =
      body.recordId ||
      body.record?.id ||
      body.input?.recordId ||
      body.payload?.recordId;

    if (!recordId) {
      console.warn(
        "Could not extract record ID from Airtable automation payload"
      );
      return NextResponse.json(
        {
          status: "error",
          message: "Record ID not found in request body",
        },
        { status: 400 }
      );
    }

    console.log(`Processing service request from Airtable automation: ${recordId}`);

    // Process the service request
    const result = await processServiceRequest(recordId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in Airtable automation endpoint:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
