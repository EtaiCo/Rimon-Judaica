/**
 * API base URL.
 *
 * In production (Vercel) this should be set to the Render backend, e.g.
 * `https://rimon-judaica.onrender.com`. In local dev leave it unset so requests
 * stay same-origin and get forwarded to `localhost:4000` by the Vite proxy
 * configured in `apps/storefront/vite.config.ts`.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

if (import.meta.env.PROD) {
  // Temporary: confirm the build-time VITE_API_BASE_URL actually made it into the bundle.
  // Remove once production routing is confirmed working.
  console.info(
    "[api] Base URL:",
    API_BASE || "(empty - env var missing at build time)",
  );
}

/** Prepend the configured API base URL to a relative path. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Core API fetcher.
 * Automatically routes requests to the configured API base (Render backend in
 * production, empty in dev so the Vite proxy kicks in).
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
