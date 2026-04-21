import { useEffect, useState } from "react";
import { useAdminAuth } from "./useAdminAuth";
import { adminApi } from "../api/client";

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useAdminFetch<T>(path: string | null): AsyncState<T> {
  const { accessToken } = useAdminAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    adminApi
      .get<T>(accessToken, path)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "שגיאה");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, accessToken, tick]);

  return {
    data,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
