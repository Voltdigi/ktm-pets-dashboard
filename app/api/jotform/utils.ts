import crypto from "crypto";

export function verifyJotFormSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!process.env.JOTFORM_WEBHOOK_TOKEN || !signature) {
    console.warn("Webhook token or signature missing");
    return false;
  }

  const hash = crypto
    .createHmac("sha256", process.env.JOTFORM_WEBHOOK_TOKEN)
    .update(payload)
    .digest("hex");

  return hash === signature;
}

export function formatDate(dateObj: any): string | null {
  if (!dateObj) return null;
  const { day, month, year } = dateObj;
  if (!day || !month || !year) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

export function formatFullName(nameObj: any): string {
  if (!nameObj) return "";
  const first = nameObj.first || "";
  const last = nameObj.last || "";
  return `${first} ${last}`.trim();
}

export function formatPhoneNumber(phoneObj: any): string {
  if (!phoneObj) return "";
  const area = phoneObj.area || "";
  const phone = phoneObj.phone || "";
  return `${area}${phone}`;
}

export function convertBracketNotation(
  flatData: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = {};

  Object.entries(flatData).forEach(([key, value]) => {
    const bracketMatch = key.match(/^(\w+)\[(\w+)\]$/);

    if (bracketMatch) {
      const [, parent, child] = bracketMatch;
      if (!result[parent]) result[parent] = {};
      result[parent][child] = value;
    } else {
      result[key] = value;
    }
  });

  return result;
}
