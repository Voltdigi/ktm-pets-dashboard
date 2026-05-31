import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  findServiceRequestByInvoiceId,
  updateServiceRequest,
  getServiceRequest,
  createConfirmedBookings,
} from "../airtable";
import { publishInvoice, getInvoiceById } from "../utils";

// Verify Square webhook signature
function verifySquareWebhookSignature(
  body: string,
  signature: string | null,
  webhookUrl: string
): boolean {
  if (!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || !signature) {
    console.warn("Webhook signature key or signature missing");
    return false;
  }

  const hash = crypto
    .createHmac("sha256", process.env.SQUARE_WEBHOOK_SIGNATURE_KEY)
    .update(webhookUrl + body)
    .digest("base64");

  return hash === signature;
}

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
    const fields = serviceRequest.fields as Record<string, any>;
    const squareDepositInvoiceId = fields["Square Deposit Invoice ID"];
    const squareBalanceInvoiceId = fields["Square Balance Invoice ID"];
    const squareCustomerId = fields["Square Customer ID"];
    const clientEmail = fields["Client Email"];

    // Check if this is the deposit invoice
    if (invoiceId === squareDepositInvoiceId) {
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

      // If balance invoice hasn't been published yet, publish it now
      if (squareBalanceInvoiceId) {
        const balancePublished = fields["Balance Invoice Published"];

        if (!balancePublished) {
          try {
            const balanceInvoice = await getInvoiceById(squareBalanceInvoiceId);

            if (balanceInvoice && balanceInvoice.version !== undefined) {
              console.log(`Publishing balance invoice ${squareBalanceInvoiceId} (version ${balanceInvoice.version})`);
              await publishInvoice(squareBalanceInvoiceId, balanceInvoice.version);
              console.log(`Balance invoice ${squareBalanceInvoiceId} published successfully`);

              // Mark as published to prevent re-publishing on webhook retry
              await updateServiceRequest(recordId, {
                balanceInvoicePublished: true,
              });
            } else {
              console.warn(`Could not retrieve version for balance invoice ${squareBalanceInvoiceId}`);
            }
          } catch (error) {
            console.error("Error publishing balance invoice:", error);
            // Don't fail the entire webhook if balance invoice publication fails
          }
        } else {
          console.log(`Balance invoice ${squareBalanceInvoiceId} already published, skipping`);
        }
      }

      return {
        status: "success",
        message: "Deposit payment recorded and status updated",
        serviceRequestId: recordId,
      };
    }

    // Check if this is the balance invoice
    if (invoiceId === squareBalanceInvoiceId) {
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
      message: "Invoice type not recognized",
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

    // Reconstruct the webhook URL using the host header (for ngrok compatibility)
    const host = request.headers.get("host") || "localhost:3000";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const pathname = new URL(request.url).pathname + new URL(request.url).search;
    const webhookUrl = `${proto}://${host}${pathname}`;

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
