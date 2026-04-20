/**
 * Versioned localStorage SWR cache with in-flight request deduplication.
 *
 * Every key is prefixed with a version tag so a schema change naturally
 * invalidates stale entries without migration logic.
 */

import { apiUrl } from "./api";

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — silently skip */
  }
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Key helpers (versioned)
// ---------------------------------------------------------------------------

export const CACHE_KEYS = {
  categoryProducts: (catSlug: string, subSlug: string) =>
    `rimon.cp.v1::${catSlug}::${subSlug}`,
  product: (productId: string) => `rimon.p.v1::${productId}`,
  featuredProducts: () => "rimon.pl.v1::featured",
  serverCart: (customerId: string) => `rimon.cart.server.v1::${customerId}`,
} as const;

// ---------------------------------------------------------------------------
// In-flight request deduplication
// ---------------------------------------------------------------------------

const inflightMap = new Map<string, Promise<unknown>>();

/**
 * Ensures only one network request per cache key is in-flight at a time.
 * Concurrent callers share the same promise. The entry is cleared once the
 * promise settles so future callers trigger a fresh request.
 */
export function deduped<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflightMap.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher().finally(() => {
    inflightMap.delete(key);
  });
  inflightMap.set(key, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Fetch-with-SWR (imperative, non-React)
// ---------------------------------------------------------------------------

export type SwrResult<T> = {
  cached: T | null;
  fresh: Promise<T | null>;
};

/**
 * Read cached data synchronously, then kick off a background fetch that
 * updates localStorage when the response differs. Dedupes concurrent calls.
 */
export function fetchWithSwr<T>(
  key: string,
  fetcher: () => Promise<T | null>,
): SwrResult<T> {
  const cached = readJson<T>(key);
  const fresh = deduped(key, async () => {
    const data = await fetcher();
    if (data == null) return cached;
    if (stableStringify(data) !== stableStringify(cached)) {
      writeJson(key, data);
    }
    return data;
  });
  return { cached, fresh };
}

// ---------------------------------------------------------------------------
// Shared prefetch helper (for Header hover)
// ---------------------------------------------------------------------------

export async function prefetchCategoryProducts(
  categorySlug: string,
  subSlug: string,
): Promise<void> {
  const key = CACHE_KEYS.categoryProducts(categorySlug, subSlug);
  await deduped(key, async () => {
    try {
      const res = await fetch(
        apiUrl(
          `/api/categories/${encodeURIComponent(categorySlug)}/${encodeURIComponent(subSlug)}/products`,
        ),
      );
      if (!res.ok) return null;
      const data = await res.json();
      writeJson(key, data);
      return data;
    } catch {
      return null;
    }
  });
}
