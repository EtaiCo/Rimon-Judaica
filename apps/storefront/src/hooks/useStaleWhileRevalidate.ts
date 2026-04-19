import { useEffect, useState } from "react";
import {
  readJson,
  writeJson,
  stableStringify,
  deduped,
} from "../lib/cacheService";

export type SwrState<T> = {
  data: T | null;
  isValidating: boolean;
  /** True when we had a cached snapshot at mount time. */
  hadCache: boolean;
};

/**
 * Generic stale-while-revalidate hook backed by versioned localStorage.
 *
 * 1. Synchronously reads `localStorage[cacheKey]` → initial state.
 * 2. Fires `fetcher()` (deduped by key) in the background.
 * 3. If the fresh payload differs from cache, updates state + storage.
 */
export function useStaleWhileRevalidate<T>(
  cacheKey: string | null,
  fetcher: (() => Promise<T | null>) | null,
): SwrState<T> {
  const [state, setState] = useState<SwrState<T>>(() => {
    const cached = cacheKey ? readJson<T>(cacheKey) : null;
    return { data: cached, isValidating: true, hadCache: cached != null };
  });

  useEffect(() => {
    if (!cacheKey || !fetcher) {
      setState((prev) => ({ ...prev, isValidating: false }));
      return;
    }

    let cancelled = false;
    const cached = readJson<T>(cacheKey);
    setState({ data: cached, isValidating: true, hadCache: cached != null });

    deduped(cacheKey, fetcher)
      .then((fresh) => {
        if (cancelled || fresh == null) return;
        const freshStr = stableStringify(fresh);
        setState((prev) => {
          if (stableStringify(prev.data) === freshStr) return prev;
          writeJson(cacheKey, fresh);
          return { ...prev, data: fresh };
        });
      })
      .finally(() => {
        if (!cancelled) {
          setState((prev) => (prev.isValidating ? { ...prev, isValidating: false } : prev));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, fetcher]);

  return state;
}
