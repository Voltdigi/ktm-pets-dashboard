import { NextRequest, NextResponse } from "next/server";
import {
  findServiceRequestByInvoiceId,
  updateServiceRequest,
  getServiceRequest,
  createConfirmedBookings,
} from "../airtable";
import {
  publishInvoice,
  getInvoiceById,
  verifySquareWebhookSignature,
} from "../utils";

interface SquareEvent {
  type: string;
  data?: {
    object?: {
      invoice?: {
        id: string;
        customFields?: Array<{
          label: string;
          value: string;
        }>;
      };
    };
  };
}

async function handleInvoicePaymentMade(invoiceId: string) {
  try {
    console.log(`Handling payment for invoice: ${invoiceId}`);

    // Find service request by invoice ID
    const serviceRequest = await findServiceRequestByInvoiceId(invoiceId);

    if (!serviceRequest) {
      console.warn(`No service request found for invoice ${invoiceId}`);
      return { status: "skipped", message: "Service request not found" };
    }

    const recordId = serviceRequest.id;

    // Fetch the invoice to check which payment request was paid
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      console.warn(`Could not fetch invoice ${invoiceId}`);
      return { status: "skipped", message: "Could not fetch invoice" };
    }

    // Check the payment requests to determine which was just paid
    const paymentRequests = invoice.payment_requests || [];
    const depositRequest = paymentRequests.find((r: any) => r.request_type === "DEPOSIT");
    const balanceRequest = paymentRequests.find((r: any) => r.request_type === "BALANCE");

    const depositPaid = (depositRequest?.total_completed_amount_money?.amount || 0) > 0;
    const balancePaid = (balanceRequest?.total_completed_amount_money?.amount || 0) > 0;

    // If deposit is paid and balance is not, deposit was just paid
    if (depositPaid && !balancePaid) {
      console.log(`Deposit paid for service request ${recordId}`);

      // Update status to "Deposit Paid"
      await updateServiceRequest(recordId, {
        status: "Deposit Paid",
      });

      // Create confirmed booking records for each date
      try {
        const serviceRequest = await getServiceRequest(recordId);
        await createConfirmedBookings(serviceRequest);
      } catch (error) {
        console.error("Error creating confirmed bookings:", error);
        // Don't fail the entire webhook if booking creation fails
      }

      return {
        status: "success",
        message: "Deposit payment recorded and status updated",
        serviceRequestId: recordId,
      };
    }

    // If both deposit and balance are paid, balance was just paid
    if (depositPaid && balancePaid) {
      console.log(`Balance paid for service request ${recordId}`);

      // Update status to "Full Paid"
      await updateServiceRequest(recordId, {
        status: "Full Paid",
      });

      return {
        status: "success",
        message: "Balance payment recorded",
        serviceRequestId: recordId,
      };
    }

    return {
      status: "skipped",
      message: "No relevant payment state detected",
    };
  } catch (error) {
    console.error("Error handling invoice payment:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-square-hmacsha256-signature");

    // Reconstruct the webhook URL using host header (works for ngrok and Vercel)
    const host = request.headers.get("host") || "localhost:3000";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const url = new URL(request.url);
    const pathname = url.pathname + url.search;
    const webhookUrl = `${proto}://${host}${pathname}`;

    console.log(`Webhook URL for signature: ${webhookUrl}`);

    // Verify signature
    if (!verifySquareWebhookSignature(rawBody, signature, webhookUrl)) {
      console.warn("Invalid Square webhook signature");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const event: SquareEvent = JSON.parse(rawBody);

    console.log(`Received Square webhook event: ${event.type}`);

    // Handle invoice payment made event
    if (event.type === "invoice.payment_made") {
      const invoiceId = event.data?.object?.invoice?.id;

      if (!invoiceId) {
        console.warn("Missing invoice ID in webhook event");
        return NextResponse.json(
          { error: "Missing invoice ID" },
          { status: 400 }
        );
      }

      const result = await handleInvoicePaymentMade(invoiceId);
      return NextResponse.json(result);
    }

    // For other event types, just acknowledge receipt
    return NextResponse.json({
      status: "acknowledged",
      eventType: event.type,
    });
  } catch (error) {
    console.error("Error processing Square webhook:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
