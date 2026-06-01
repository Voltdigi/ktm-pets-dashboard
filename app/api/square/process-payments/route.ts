import { NextRequest, NextResponse } from "next/server";
import {
  createOrGetSquareCustomer,
  createInvoice,
  publishInvoice,
} from "../utils";
import {
  getPendingPaymentRequests,
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
      return { status: "skipped", message: "Invoices already exist" };
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
      serviceRequestData: {
        preferredDates: fields["Preferred Date and Time"],
        pricePerUnit: fields["Price Per Unit"],
        addOnPrice: fields["Add-on Price"],
        serviceType: fields["Service Type"],
      },
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
      customerId: customer.id,
      invoiceId: invoice.id,
    };
  } catch (error) {
    console.error(`Error processing service request ${recordId}:`, error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    let serviceRequestId: string | undefined;

    // Handle cron requests (empty body) and manual API calls
    try {
      const body = await request.json();
      serviceRequestId = body.serviceRequestId;
    } catch {
      // Cron requests have no body, which is fine
      console.log("Processing cron request - no body provided");
    }

    // If specific service request ID provided, process just that one
    if (serviceRequestId) {
      const result = await processServiceRequest(serviceRequestId);
      return NextResponse.json(result);
    }

    // Otherwise, fetch all pending payment requests and process them
    const pendingRequests = await getPendingPaymentRequests();

    if (pendingRequests.length === 0) {
      return NextResponse.json({
        status: "success",
        message: "No pending payment requests found",
        processed: 0,
      });
    }

    console.log(`Found ${pendingRequests.length} pending payment requests`);

    // Process each pending request
    const results = await Promise.all(
      pendingRequests.map((record) => processServiceRequest(record.id))
    );

    const successful = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "error").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return NextResponse.json({
      status: "success",
      message: `Processed ${pendingRequests.length} requests`,
      results: {
        successful,
        failed,
        skipped,
        details: results,
      },
    });
  } catch (error) {
    console.error("Error in process-payments endpoint:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch pending requests without processing
export async function GET() {
  try {
    const pendingRequests = await getPendingPaymentRequests();

    return NextResponse.json({
      status: "success",
      count: pendingRequests.length,
      requests: pendingRequests.map((r) => ({
        id: r.id,
        clientName: r.fields["Client Name"],
        clientEmail: r.fields["Client Email"],
        depositAmount: r.fields["Deposit Amount"],
      })),
    });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
