/** Relative `/api/*` calls work with the Vite dev proxy; production needs same-origin or a configured base URL. */
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
  return fetch(path, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}
