/**
 * API base URL.
 *
 * Set `VITE_API_BASE_URL` in production (Vercel) to the Render backend, e.g.
 * `https://rimon-judaica.onrender.com`. In local dev leave it unset so requests
 * stay same-origin and get forwarded to `localhost:4000` by the Vite proxy
 * configured in `apps/storefront/vite.config.ts`.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

/** Prepend the configured API base URL to a relative path. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}

/**
 * Authenticated JSON fetcher. Routes through `apiUrl` so dev uses the Vite
 * proxy and production uses `VITE_API_BASE_URL`.
 */
export async function apiFetch(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    accessToken: string | null;
  },
): Promise<Response> {
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  return fetch(apiUrl(path), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

function generateIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const arr = new Uint8Array(16);
  (c as Crypto | undefined)?.getRandomValues?.(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Admin-specific fetcher. Adds `Idempotency-Key` on mutating calls
 * (auto-generated if not supplied) and optionally a sudo password for
 * step-up re-authentication on destructive operations.
 */
export async function apiAdminFetch(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    accessToken: string | null;
    idempotencyKey?: string;
    sudoPassword?: string;
  },
): Promise<Response> {
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  const method = (options.method ?? "GET").toUpperCase();
  const isMutating = method !== "GET" && method !== "HEAD";
  if (isMutating) {
    headers.set(
      "Idempotency-Key",
      options.idempotencyKey ?? generateIdempotencyKey(),
    );
  }
  if (options.sudoPassword) {
    headers.set("X-Sudo-Password", options.sudoPassword);
  }

  return fetch(apiUrl(path), {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/** Parse a JSON response safely; returns undefined on non-JSON bodies. */
export async function parseJsonOrUndefined<T>(
  res: Response,
): Promise<T | undefined> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}
