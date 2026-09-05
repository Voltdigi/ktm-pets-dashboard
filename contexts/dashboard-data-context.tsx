"use client";

import useSWR from "swr";
import { createContext, useContext, useMemo } from "react";
import { buildPetsByClientId, buildById } from "@/lib/airtable-joins";
import type { AirtableRecord } from "@/lib/airtable";

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((r) => {
      if (!r.success) throw new Error(r.error);
      return r.data;
    });

const TABLE_IDS = {
  clients: process.env.NEXT_PUBLIC_CLIENTS_TABLE_ID!,
  pets: process.env.NEXT_PUBLIC_PETS_TABLE_ID!,
  serviceRequests: process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID!,
  bookings: process.env.NEXT_PUBLIC_CONFIRMED_BOOKINGS_TABLE_ID!,
};

const SWR_CONFIG = {
  revalidateOnFocus: false,
  dedupingInterval: 60_000, // 1 min: no two identical requests within 1 min
};

interface UseTableResult {
  data: AirtableRecord[];
  error?: Error;
  isLoading: boolean;
  refresh: () => void;
}

function useTable(key: keyof typeof TABLE_IDS): UseTableResult {
  const url = `/api/clients?tableId=${TABLE_IDS[key]}`;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, SWR_CONFIG);

  const refresh = () => {
    // Force a server-side cache invalidation by passing force=1,
    // then tell SWR to refetch from that fresh endpoint.
    mutate(fetcher(`${url}&force=1`), { revalidate: false });
  };

  return {
    data: data ?? [],
    error,
    isLoading,
    refresh,
  };
}

interface DashboardDataContextType {
  clients: AirtableRecord[];
  pets: AirtableRecord[];
  serviceRequests: AirtableRecord[];
  bookings: AirtableRecord[];
  petsByClientId: Map<string, string[]>;
  serviceRequestsById: Map<string, AirtableRecord>;
  clientsById: Map<string, AirtableRecord>;
  isLoading: boolean;
  error?: Error;
  refreshClients: () => void;
  refreshPets: () => void;
  refreshServiceRequests: () => void;
  refreshBookings: () => void;
  refreshAll: () => void;
}

const DashboardDataContext = createContext<DashboardDataContextType | null>(null);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const clients = useTable("clients");
  const pets = useTable("pets");
  const serviceRequests = useTable("serviceRequests");
  const bookings = useTable("bookings");

  // Precompute join maps for fast O(1) lookups in components.
  const petsByClientId = useMemo(
    () => buildPetsByClientId(pets.data),
    [pets.data]
  );

  const serviceRequestsById = useMemo(
    () => buildById(serviceRequests.data),
    [serviceRequests.data]
  );

  const clientsById = useMemo(() => buildById(clients.data), [clients.data]);

  const isLoading =
    clients.isLoading ||
    pets.isLoading ||
    serviceRequests.isLoading ||
    bookings.isLoading;

  const error =
    clients.error || pets.error || serviceRequests.error || bookings.error;

  const value: DashboardDataContextType = {
    clients: clients.data,
    pets: pets.data,
    serviceRequests: serviceRequests.data,
    bookings: bookings.data,
    petsByClientId,
    serviceRequestsById,
    clientsById,
    isLoading,
    error,
    refreshClients: clients.refresh,
    refreshPets: pets.refresh,
    refreshServiceRequests: serviceRequests.refresh,
    refreshBookings: bookings.refresh,
    refreshAll: () => {
      clients.refresh();
      pets.refresh();
      serviceRequests.refresh();
      bookings.refresh();
    },
  };

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData(): DashboardDataContextType {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error(
      "useDashboardData must be used inside a DashboardDataProvider"
    );
  }
  return context;
}
