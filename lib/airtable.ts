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

// Dashboard reads: 10 min TTL (fresh enough for staff, economical on quota)
const DASHBOARD_TTL = 600;

// Calendar feed reads: 4-hour TTL — webcal subscriptions don't need sub-hour
// freshness, and calendar apps poll on their own schedule anyway.
const CALENDAR_TTL = 14400;

/**
 * Fetch a table with dashboard-tier caching (10-min TTL).
 * Used by all dashboard pages and the /api/clients route.
 */
export const getCachedTable = (key: TableKey) =>
  unstable_cache(() => fetchTableRaw(key), [`airtable-${key}`], {
    revalidate: DASHBOARD_TTL,
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
 * Placeholder for cache invalidation.
 * Note: Next.js data cache invalidation is handled via the `force=1` query parameter
 * in the API route, which bypasses the cache layer directly.
 * Full tag-based revalidation can be added when using ISR or on-demand revalidation.
 */
export async function invalidateTable(key: TableKey) {
  // Cache invalidation is handled at the API route level via the force=1 parameter
  console.log(`[cache-invalidation] Marked table ${key} for potential invalidation`);
}
