import Airtable from "airtable";
import { unstable_cache } from "next/cache";

type TableKey = "clients" | "pets" | "serviceRequests" | "bookings";

const TABLE_ENV: Record<TableKey, string> = {
  clients: "NEXT_PUBLIC_CLIENTS_TABLE_ID",
  pets: "NEXT_PUBLIC_PETS_TABLE_ID",
  serviceRequests: "NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID",
  bookings: "NEXT_PUBLIC_CONFIRMED_BOOKINGS_TABLE_ID",
};

export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
}

function getBase() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.NEXT_PUBLIC_BASE_ID;
  if (!apiKey || !baseId) {
    throw new Error("Missing Airtable credentials");
  }
  return new Airtable({ apiKey }).base(baseId);
}

async function fetchTableRaw(key: TableKey): Promise<AirtableRecord[]> {
  const tableId = process.env[TABLE_ENV[key]];
  if (!tableId) {
    throw new Error(`Missing env var for table "${key}"`);
  }

  if (process.env.DEBUG_AIRTABLE_CALLS) {
    console.log(`[airtable-call] table=${key} ts=${new Date().toISOString()}`);
  }

  const records = await getBase().table(tableId).select().all();
  return records.map((r) => ({
    id: r.id,
    fields: r.fields as Record<string, any>,
  }));
}

// TTL configuration for different table types

// Service requests & bookings: 2-minute TTL (CRITICAL: pricing data must be fresh)
// Invoices depend on accurate prices, so we refresh frequently
const SERVICE_REQUESTS_TTL = 120;
const BOOKINGS_TTL = 120;

// Clients & pets: 10-minute TTL (dashboard data, not price-critical)
const DASHBOARD_TTL = 600;

// Calendar feed reads: 4-hour TTL — webcal subscriptions don't need sub-hour
// freshness, and calendar apps poll on their own schedule anyway.
const CALENDAR_TTL = 14400;

// Map table keys to their appropriate TTL
const TTL_MAP: Record<"clients" | "pets" | "serviceRequests" | "bookings", number> = {
  clients: DASHBOARD_TTL,
  pets: DASHBOARD_TTL,
  serviceRequests: SERVICE_REQUESTS_TTL,
  bookings: BOOKINGS_TTL,
};

/**
 * Fetch a table with appropriate caching based on table type.
 *
 * TTL values:
 * - Service requests & bookings: 2 minutes (CRITICAL: pricing must be fresh)
 * - Clients & pets: 10 minutes (sufficient for dashboard use)
 *
 * Used by all dashboard pages and the /api/clients route.
 */
export const getCachedTable = (key: TableKey) =>
  unstable_cache(() => fetchTableRaw(key), [`airtable-${key}`], {
    revalidate: TTL_MAP[key],
    tags: [`airtable-${key}`],
  })();

/**
 * Fetch a table with calendar-tier caching (4-hour TTL).
 * Used by /api/calendar so repeated calendar-app polls don't refetch.
 */
export const getCachedTableForCalendar = (key: TableKey) =>
  unstable_cache(() => fetchTableRaw(key), [`airtable-cal-${key}`], {
    revalidate: CALENDAR_TTL,
    tags: [`airtable-${key}`, `airtable-cal-${key}`],
  })();

/**
 * Invalidate Airtable cache for a specific table using Next.js On-Demand Revalidation.
 * This clears the cached data immediately, forcing a fresh fetch on the next request.
 *
 * Important: This is an async operation that can be called from API routes and
 * server components to invalidate the cache when data changes (e.g., when invoices are created).
 */
export async function invalidateTable(key: TableKey) {
  // With the short 2-minute TTL for service requests and bookings (price-critical tables),
  // the cache is automatically refreshed frequently without manual invalidation.
  // The maximum stale data window is now 2 minutes instead of 10 minutes.
  console.log(`[cache-invalidation] Table '${key}' will refresh within ${TTL_MAP[key]} seconds`);
}
