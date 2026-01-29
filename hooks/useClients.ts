import { useState, useEffect } from "react";

export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
}

interface UseAirtableDataReturn {
  data: AirtableRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAirtableData(tableId: string): UseAirtableDataReturn {
  const [data, setData] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/clients?tableId=${tableId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tableId]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

// Backward compatibility export
export function useClients() {
  return useAirtableData(process.env.NEXT_PUBLIC_CLIENTS_TABLE_ID || "");
}
