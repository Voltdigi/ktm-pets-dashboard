import crypto from "crypto";

// Parse preferred dates from Airtable format
export interface ParsedDateEntry {
  originalEntry: string; // "26/05/2026 | Midday"
  datePart: string; // "26/05/2026"
  timePart: string; // "Midday"
  isoDate: string; // "2026-05-26"
  day: string;
  month: string;
  year: string;
}

export function parsePreferredDates(preferredDatesJson: string): ParsedDateEntry[] {
  try {
    const dateData = JSON.parse(preferredDatesJson);
    const dates: string[] = dateData.standardised_dates || [];

    return dates.map(entry => {
      const [datePart, timePart] = entry.split(" | ").map((s: string) => s.trim());
      const [day, month, year] = datePart.split("/");
      const isoDate = `${year}-${month}-${day}`;

      return {
        originalEntry: entry,
        datePart,
        timePart: timePart || "",
        isoDate,
        day,
        month,
        year,
      };
    });
  } catch (error) {
    console.error("Error parsing preferred dates:", error);
    return [];
  }
}

// Get first booking date as ISO string
export function getFirstBookingDate(preferredDatesJson: string): string | null {
  const parsed = parsePreferredDates(preferredDatesJson);
  return parsed.length > 0 ? parsed[0].isoDate : null;
}

function isSandbox() {
  return process.env.SQUARE_ENVIRONMENT === "sandbox";
}

function getSquareAccessToken() {
  return isSandbox()
    ? process.env.SQUARE_ACCESS_TOKEN_SANDBOX
    : process.env.SQUARE_ACCESS_TOKEN_PRODUCTION;
}

export function getSquareLocationId() {
  return isSandbox()
    ? process.env.SQUARE_LOCATION_ID_SANDBOX
    : process.env.SQUARE_LOCATION_ID_PRODUCTION;
}

function getSquareWebhookSignatureKey() {
  return isSandbox()
    ? process.env.SQUARE_WEBHOOK_SIGNATURE_KEY_SANDBOX
    : process.env.SQUARE_WEBHOOK_SIGNATURE_KEY_PRODUCTION;
}

// Make raw HTTP request to Square API
async function makeSquareRequest(
  method: string,
  path: string,
  body?: any
) {
  const token = getSquareAccessToken();
  const squareBaseUrl = isSandbox()
    ? "https://connect.squareupsandbox.com/v2"
    : "https://connect.squareup.com/v2";
  const url = `${squareBaseUrl}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Square-Version": "2024-07-17",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Square API error:", data);
    throw new Error(`Square API error: ${JSON.stringify(data)}`);
  }

  return data;
}

// Create or fetch Square customer by email
export async function createOrGetSquareCustomer(
  email: string,
  clientName: string
) {
  try {
    // Search for existing customer by email
    const searchResponse = await makeSquareRequest("POST", "/customers/search", {
      query: {
        filter: {
          email_address: {
            exact: email,
          },
        },
      },
    });

    if (
      searchResponse.customers &&
      searchResponse.customers.length > 0
    ) {
      console.log(`Found existing customer for email: ${email}`);
      return searchResponse.customers[0];
    }

    // Create new customer
    console.log(`Creating new Square customer for ${clientName} (${email})`);
    const createResponse = await makeSquareRequest("POST", "/customers", {
      email_address: email,
      given_name: clientName.split(" ")[0],
      family_name: clientName.split(" ").slice(1).join(" "),
    });

    if (!createResponse.customer) {
      throw new Error("Failed to create customer");
    }

    console.log(
      `Created new Square customer: ${createResponse.customer.id}`
    );
    return createResponse.customer;
  } catch (error) {
    console.error("Error creating/fetching Square customer:", error);
    throw error;
  }
}

// Create order for invoice with detailed line items
async function createOrderForInvoice(
  locationId: string,
  customerId: string,
  lineItems: Array<{ name: string; amount: number }>
) {
  const orderLineItems = lineItems.map(item => ({
    name: item.name,
    quantity: "1",
    base_price_money: {
      amount: Math.round(item.amount * 100),
      currency: "GBP",
    },
  }));

  const orderResponse = await makeSquareRequest("POST", "/orders", {
    order: {
      location_id: locationId,
      customer_id: customerId,
      line_items: orderLineItems,
    },
  });

  return orderResponse.order;
}

interface CreateInvoiceParams {
  customerId: string;
  customerEmail: string;
  clientName: string;
  depositAmount: number;
  balanceAmount: number;
  description: string;
  serviceRequestId: string;
  serviceRequestData?: {
    preferredDates?: string; // JSON string with standardised_dates
    pricePerUnit?: number;
    addOnPrice?: number;
    serviceType?: string;
  };
}

// Create invoice with deposit and balance payment requests
export async function createInvoice(params: CreateInvoiceParams) {
  const locationId = getSquareLocationId();

  if (!locationId) {
    throw new Error("Missing Square location ID");
  }

  try {
    // Build line items from service request data
    const lineItems: Array<{ name: string; amount: number }> = [];

    // Calculate deposit and balance due dates
    let depositDueDate: string;
    let balanceDueDate: string;

    // Deposit is due immediately
    depositDueDate = new Date().toISOString().split("T")[0];

    // Balance due date is calculated from first booking date
    if (params.serviceRequestData?.preferredDates && params.serviceRequestData?.serviceType) {
      const parsedDates = parsePreferredDates(params.serviceRequestData.preferredDates);

      if (parsedDates.length > 0) {
        const firstBookingDate = new Date(parsedDates[0].isoDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Determine days before booking based on service type
        const serviceType = params.serviceRequestData.serviceType;
        const daysBeforeBooking = serviceType.includes("Pet Sitting") ? 10 : 5;

        // Calculate balance due date (X days before first booking)
        const balanceDueDateObj = new Date(firstBookingDate);
        balanceDueDateObj.setDate(balanceDueDateObj.getDate() - daysBeforeBooking);

        // Calculate days until the calculated balance due date
        const daysUntilDue = Math.floor((balanceDueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // If calculated date is less than 5 days away or in the past, set due date to immediate
        if (daysUntilDue < 5) {
          balanceDueDate = depositDueDate;
          console.log(`Balance due date was less than 5 days away, setting to immediate`);
        } else {
          balanceDueDate = balanceDueDateObj.toISOString().split("T")[0];
          console.log(`First booking: ${parsedDates[0].datePart}, Balance due: ${daysBeforeBooking} days before`);
        }
      } else {
        // Fallback to default
        const balanceDueDateObj = new Date();
        balanceDueDateObj.setDate(balanceDueDateObj.getDate() + 30);
        balanceDueDate = balanceDueDateObj.toISOString().split("T")[0];
      }
    } else {
      // Fallback if no service data
      const balanceDueDateObj = new Date();
      balanceDueDateObj.setDate(balanceDueDateObj.getDate() + 30);
      balanceDueDate = balanceDueDateObj.toISOString().split("T")[0];
    }

    if (params.serviceRequestData?.preferredDates && params.serviceRequestData?.pricePerUnit) {
      const parsedDates = parsePreferredDates(params.serviceRequestData.preferredDates);
      const pricePerUnit = params.serviceRequestData.pricePerUnit;
      const addOnPrice = params.serviceRequestData.addOnPrice || 0;
      const serviceType = params.serviceRequestData.serviceType || "Service";

      if (parsedDates.length > 0) {
        // Create a line item for each date, folding the add-on into the per-date unit price
        for (const parsed of parsedDates) {
          lineItems.push({
            name: `${serviceType} - ${parsed.datePart}`,
            amount: pricePerUnit + addOnPrice,
          });
        }
      } else {
        // Fallback to simple line item if date parsing fails
        lineItems.push({
          name: params.description,
          amount: params.depositAmount + params.balanceAmount,
        });
      }
    } else {
      // Fallback if no detailed data provided
      lineItems.push({
        name: params.description,
        amount: params.depositAmount + params.balanceAmount,
      });
    }

    const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Create single order with detailed line items
    const order = await createOrderForInvoice(
      locationId,
      params.customerId,
      lineItems
    );

    // Create single invoice with deposit and balance payment requests
    const invoiceResponse = await makeSquareRequest("POST", "/invoices", {
      invoice: {
        location_id: locationId,
        order_id: order.id,
        primary_recipient: {
          customer_id: params.customerId,
        },
        payment_requests: [
          {
            request_type: "DEPOSIT",
            fixed_amount_requested_money: {
              amount: Math.round(params.depositAmount * 100),
              currency: "GBP",
            },
            due_date: depositDueDate,
            tipping_enabled: false,
          },
          {
            request_type: "BALANCE",
            due_date: balanceDueDate,
            tipping_enabled: false,
          }
        ],
        accepted_payment_methods: {
          card: true,
        },
        delivery_method: "EMAIL",
        invoice_number: `INV-${params.serviceRequestId}-${Date.now()}`,
        title: params.description,
      }
    });

    if (!invoiceResponse.invoice) {
      throw new Error("Failed to create invoice");
    }

    console.log(`Created invoice with deposit and balance: ${invoiceResponse.invoice.id}`);
    return invoiceResponse.invoice;
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw error;
  }
}

// Publish invoice
export async function publishInvoice(invoiceId: string, version: number) {
  const locationId = getSquareLocationId();

  if (!locationId) {
    throw new Error("Missing Square location ID");
  }

  try {
    const publishResponse = await makeSquareRequest(
      "POST",
      `/invoices/${invoiceId}/publish`,
      { version }
    );

    if (!publishResponse.invoice) {
      throw new Error("Failed to publish invoice");
    }

    console.log(`Published invoice: ${invoiceId}`);
    return publishResponse.invoice;
  } catch (error) {
    console.error("Error publishing invoice:", error);
    throw error;
  }
}

// Get invoice by ID (to retrieve current version)
export async function getInvoiceById(invoiceId: string) {
  try {
    const invoiceResponse = await makeSquareRequest("GET", `/invoices/${invoiceId}`);
    return invoiceResponse.invoice;
  } catch (error) {
    console.error(`Error fetching invoice ${invoiceId}:`, error);
    throw error;
  }
}

// Verify Square webhook signature
export function verifySquareWebhookSignature(
  body: string,
  signature: string | null,
  webhookUrl: string
): boolean {
  const webhookSignatureKey = getSquareWebhookSignatureKey();

  if (!webhookSignatureKey || !signature) {
    console.warn("Webhook signature key or signature missing");
    return false;
  }

  const hash = crypto
    .createHmac("sha256", webhookSignatureKey)
    .update(webhookUrl + body)
    .digest("base64");

  return hash === signature;
}
