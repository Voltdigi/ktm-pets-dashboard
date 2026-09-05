import { formatAddress } from "./service-request-formatting";
import type { AirtableRecord } from "./airtable";

/**
 * Build a map of client IDs → pet names for fast lookups.
 * Pets have a "Client" linked-record field; one pet can link to multiple clients.
 */
export function buildPetsByClientId(pets: AirtableRecord[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const pet of pets) {
    const clientIds = pet.fields["Client"];
    const idArray = Array.isArray(clientIds) ? clientIds : clientIds ? [clientIds] : [];

    for (const clientId of idArray) {
      if (!map.has(clientId)) {
        map.set(clientId, []);
      }
      const petName = pet.fields["Pet Name"] as string;
      if (petName) {
        map.get(clientId)!.push(petName);
      }
    }
  }

  return map;
}

/**
 * Build a map of record IDs → full records for O(1) lookups.
 */
export function buildById(records: AirtableRecord[]): Map<string, AirtableRecord> {
  return new Map(records.map((r) => [r.id, r]));
}

/**
 * Extract the client ID from a service request using the TEST_CLIENTS linked-record field.
 * Returns the first linked client ID, or null if none.
 */
export function getClientIdFromServiceRequest(
  srFields: Record<string, any>
): string | null {
  const linked = srFields["TEST_CLIENTS"];
  return Array.isArray(linked) ? (linked[0] ?? null) : linked ?? null;
}

/**
 * Build a map of request IDs → bookings for fast O(1) lookups.
 * Replaces the expensive O(n*m) getLinkedBookingsForRequest filter operations.
 *
 * @param bookings - Array of booking records
 * @returns Map of request ID → array of linked bookings
 */
export function buildRequestIdToBookings(
  bookings: AirtableRecord[]
): Map<string, AirtableRecord[]> {
  const map = new Map<string, AirtableRecord[]>();

  for (const booking of bookings) {
    const requestIds = booking.fields["Request ID"];
    const idArray = Array.isArray(requestIds)
      ? requestIds
      : requestIds
      ? [requestIds]
      : [];

    for (const requestId of idArray) {
      if (!map.has(requestId)) {
        map.set(requestId, []);
      }
      map.get(requestId)!.push(booking);
    }
  }

  return map;
}

/**
 * Find all bookings linked to a service request via the "Request ID" field.
 * @deprecated Use buildRequestIdToBookings() for better performance
 */
export function getLinkedBookingsForRequest(
  bookings: AirtableRecord[],
  requestId: string
): AirtableRecord[] {
  return bookings.filter((b) => {
    const requestIds = b.fields["Request ID"];
    if (!requestIds) return false;
    const idArray = Array.isArray(requestIds) ? requestIds : [requestIds];
    return idArray.includes(requestId);
  });
}

/**
 * Resolve all details for a booking by joining against cached data.
 * Replaces the entire `/api/bookings/details` POST round-trip with in-memory lookups.
 */
export interface BookingDetailContext {
  serviceRequestsById: Map<string, AirtableRecord>;
  petsByClientId: Map<string, string[]>;
}

export interface ResolvedBookingDetails {
  serviceRequest: Record<string, any> | null;
  pets: string;
  address: string;
}

export function resolveBookingDetails(
  booking: AirtableRecord,
  ctx: BookingDetailContext
): ResolvedBookingDetails {
  const requestIds = booking.fields["Request ID"];
  const requestId = Array.isArray(requestIds) ? requestIds[0] : requestIds;

  const serviceRequest = requestId ? ctx.serviceRequestsById.get(requestId) : null;

  if (!serviceRequest) {
    return {
      serviceRequest: null,
      pets: "N/A",
      address: "",
    };
  }

  const clientId = getClientIdFromServiceRequest(serviceRequest.fields);
  const petNames = clientId ? ctx.petsByClientId.get(clientId) ?? [] : [];

  return {
    serviceRequest: serviceRequest.fields,
    pets: petNames.length > 0 ? petNames.join(", ") : "N/A",
    address: formatAddress(serviceRequest.fields),
  };
}
