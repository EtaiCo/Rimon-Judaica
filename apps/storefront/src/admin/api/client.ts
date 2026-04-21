import { apiAdminFetch, parseJsonOrUndefined } from "../../lib/api";

export type AdminCallOptions = {
  idempotencyKey?: string;
  sudoPassword?: string;
};

export class AdminApiError extends Error {
  public status: number;
  public requestId?: string;
  public data?: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function call<T>(
  accessToken: string | null,
  method: string,
  path: string,
  body?: unknown,
  opts?: AdminCallOptions,
): Promise<T> {
  const res = await apiAdminFetch(path, {
    method,
    body,
    accessToken,
    idempotencyKey: opts?.idempotencyKey,
    sudoPassword: opts?.sudoPassword,
  });
  if (!res.ok) {
    const err = await parseJsonOrUndefined<{ error?: string; requestId?: string }>(res);
    throw new AdminApiError(
      err?.error ?? `Admin API error (${res.status})`,
      res.status,
      err,
    );
  }
  if (res.status === 204) {
    return undefined as unknown as T;
  }
  const data = await parseJsonOrUndefined<T>(res);
  return data as T;
}

export const adminApi = {
  get: <T>(token: string | null, path: string) => call<T>(token, "GET", path),
  post: <T>(
    token: string | null,
    path: string,
    body?: unknown,
    opts?: AdminCallOptions,
  ) => call<T>(token, "POST", path, body ?? {}, opts),
  patch: <T>(
    token: string | null,
    path: string,
    body?: unknown,
    opts?: AdminCallOptions,
  ) => call<T>(token, "PATCH", path, body ?? {}, opts),
  del: <T>(
    token: string | null,
    path: string,
    opts?: AdminCallOptions,
  ) => call<T>(token, "DELETE", path, undefined, opts),
};
