import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";
import { invalidateTable } from "@/lib/airtable";
import {
  createOrGetSquareCustomer,
  createInvoice,
  publishInvoice,
  getInvoiceById,
} from "../utils";
import { getAirtableBase } from "../airtable";

interface ServiceRequestFields {
  [key: string]: any;
  "Client Name": string;
  "Email": string;
  "Deposit Amount": number;
  Description?: string;
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
            addOnPrice: fields["Add-On Price"],
            serviceType: fields["Service Type"],
          },
        });

        if (!invoice.id || invoice.version === undefined) {
          throw new Error("Failed to create invoice");
        }

        // Publish invoice
        const publishedInvoice = await publishInvoice(invoice.id, invoice.version);

        // Get invoice details to retrieve public_url
        let invoiceDetails;
        try {
          invoiceDetails = await getInvoiceById(publishedInvoice.id);
        } catch (error) {
          console.error(`Error fetching invoice details: ${publishedInvoice.id}`, error);
          invoiceDetails = publishedInvoice;
        }

        // Update service request with new status and invoice ID
        const updateData: Record<string, any> = {
          "Square Customer ID": customer.id,
          "Square Invoice ID": publishedInvoice.id,
        };

        if (invoiceDetails?.public_url) {
          updateData["Square Invoice Link"] = invoiceDetails.public_url;
        }

        const updatedRecord = await updateServiceRequestStatus(recordId, newStatus, updateData);

        // Invalidate the cached service requests so clients see the update immediately
        await invalidateTable("serviceRequests");

        return NextResponse.json({
          success: true,
          message: "Status updated and invoice created",
          recordId,
          previousStatus: currentStatus,
          newStatus,
          invoice: {
            id: publishedInvoice.id,
            depositAmount,
            balanceAmount: balanceAmount || 0,
            totalAmount: depositAmount + (balanceAmount || 0),
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

    // Invalidate the cached service requests so clients see the update immediately
    await invalidateTable("serviceRequests");

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
