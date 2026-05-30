import crypto from "crypto";

// Make raw HTTP request to Square API
async function makeSquareRequest(
  method: string,
  path: string,
  body?: any
) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const url = `https://connect.squareupsandbox.com/v2${path}`;


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

// Create order for invoice
async function createOrderForInvoice(
  locationId: string,
  customerId: string,
  amount: number,
  description: string
) {
  const amountCents = Math.round(amount * 100);

  const orderResponse = await makeSquareRequest("POST", "/orders", {
    order: {
      location_id: locationId,
      customer_id: customerId,
      line_items: [
        {
          name: description,
          quantity: "1",
          base_price_money: {
            amount: amountCents,
            currency: "GBP",
          },
        },
      ],
    },
  });

  return orderResponse.order;
}

interface CreateDepositInvoiceParams {
  customerId: string;
  customerEmail: string;
  clientName: string;
  depositAmount: number;
  description: string;
  serviceRequestId: string;
}

// Create deposit invoice
export async function createDepositInvoice(
  params: CreateDepositInvoiceParams
) {
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!locationId) {
    throw new Error("Missing SQUARE_LOCATION_ID");
  }

  try {
    // Create order first
    const order = await createOrderForInvoice(
      locationId,
      params.customerId,
      params.depositAmount,
      `Deposit - ${params.description}`
    );


    // Create invoice for the order
    const invoiceResponse = await makeSquareRequest("POST", "/invoices", {
      invoice: {
        location_id: locationId,
        order_id: order.id,
        primary_recipient: {
          customer_id: params.customerId,
        },
        payment_requests: [
          {
            request_type: "BALANCE",
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            tipping_enabled: false,
          }
        ],
        accepted_payment_methods: {
          card: true,
        },
        delivery_method: "EMAIL",
        invoice_number: `DEP-${params.serviceRequestId}-${Date.now()}`,
        title: `Deposit - ${params.description}`,
      }
    });

    if (!invoiceResponse.invoice) {
      throw new Error("Failed to create invoice");
    }

    console.log(`Created deposit invoice: ${invoiceResponse.invoice.id}`);
    return invoiceResponse.invoice;
  } catch (error) {
    console.error("Error creating deposit invoice:", error);
    throw error;
  }
}

interface CreateBalanceInvoiceParams {
  customerId: string;
  customerEmail: string;
  clientName: string;
  balanceAmount: number;
  description: string;
  serviceRequestId: string;
  daysUntilDue?: number;
}

// Create balance invoice
export async function createBalanceInvoice(
  params: CreateBalanceInvoiceParams
) {
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!locationId) {
    throw new Error("Missing SQUARE_LOCATION_ID");
  }

  try {
    const daysUntilDue = params.daysUntilDue || 30;

    // Create order first
    const order = await createOrderForInvoice(
      locationId,
      params.customerId,
      params.balanceAmount,
      `Balance - ${params.description}`
    );

    console.log(`Created balance order: ${order.id}`);

    // Create invoice for the order
    const invoiceResponse = await makeSquareRequest("POST", "/invoices", {
      invoice: {
        location_id: locationId,
        order_id: order.id,
        primary_recipient: {
          customer_id: params.customerId,
        },
        payment_requests: [
          {
            request_type: "BALANCE",
            due_date: new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            tipping_enabled: false,
          }
        ],
        accepted_payment_methods: {
          card: true,
        },
        delivery_method: "EMAIL",
        invoice_number: `BAL-${params.serviceRequestId}-${Date.now()}`,
        title: `Balance - ${params.description}`,
      }
    });

    if (!invoiceResponse.invoice) {
      throw new Error("Failed to create balance invoice");
    }

    console.log(
      `Created balance invoice: ${invoiceResponse.invoice.id}`
    );
    return invoiceResponse.invoice;
  } catch (error) {
    console.error("Error creating balance invoice:", error);
    throw error;
  }
}

// Publish invoice
export async function publishInvoice(invoiceId: string, version: number) {
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!locationId) {
    throw new Error("Missing SQUARE_LOCATION_ID");
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

// Verify Square webhook signature
export function verifySquareWebhookSignature(
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
