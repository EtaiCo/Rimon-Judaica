import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Customer,
  CustomerRole,
  CustomerStatus,
} from "@rimon/shared-types";
import { apiFetch } from "../lib/api";

const STORAGE_KEY = "rimon_session";

export type AuthSession = {
  customer: Customer;
  accessToken: string;
};

function asRole(v: unknown): CustomerRole {
  return v === "admin" ? "admin" : "customer";
}

function asStatus(v: unknown): CustomerStatus {
  return v === "suspended" ? "suspended" : "active";
}

/**
 * Decode a JWT's payload without verifying its signature (the server still
 * verifies on every request). Used only to short-circuit provably-expired
 * tokens before we fire any requests, which would otherwise 401 three
 * times in parallel on every page load.
 */
function isJwtExpired(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false; // unknown shape — let the server decide
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp !== "number") return false;
    // `exp` is seconds since epoch. Add a 5s skew allowance.
    return payload.exp * 1000 <= Date.now() - 5000;
  } catch {
    return false;
  }
}

function parseStoredSession(raw: string | null): AuthSession | null {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const c = o.customer;
    if (!c || typeof c !== "object" || c === null) return null;
    const co = c as Record<string, unknown>;
    if (
      typeof o.accessToken !== "string" ||
      !o.accessToken.trim() ||
      typeof co.id !== "string" ||
      typeof co.email !== "string" ||
      typeof co.phone !== "string" ||
      typeof co.customer_type !== "string" ||
      typeof co.created_at !== "string"
    ) {
      return null;
    }
    return {
      accessToken: o.accessToken.trim(),
      customer: {
        id: co.id,
        full_name: typeof co.full_name === "string" ? co.full_name : "",
        email: co.email,
        phone: co.phone,
        customer_type: co.customer_type as Customer["customer_type"],
        role: asRole(co.role),
        status: asStatus(co.status),
        created_at: co.created_at,
        last_login:
          typeof co.last_login === "string" ? co.last_login : undefined,
      },
    };
  } catch {
    return null;
  }
}

type AuthContextValue = {
  customer: Customer | null;
  accessToken: string | null;
  isReady: boolean;
  /** Cosmetic client-side flag. Server-side gating is authoritative. */
  isAdmin: boolean;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  refreshCustomer: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // One-shot migration from the previous sessionStorage-based scheme so
    // anyone currently logged in does not get kicked out by the switch to
    // localStorage (which persists across tabs and browser restarts).
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = sessionStorage.getItem(STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(STORAGE_KEY, legacy);
        sessionStorage.removeItem(STORAGE_KEY);
        raw = legacy;
      }
    }
    const stored = parseStoredSession(raw);
    if (stored && isJwtExpired(stored.accessToken)) {
      // The token in storage has already expired — drop it silently so the
      // first render doesn't fire cart/wishlist/admin-me requests that are
      // guaranteed to 401.
      localStorage.removeItem(STORAGE_KEY);
    } else if (stored) {
      setCustomer(stored.customer);
      setAccessToken(stored.accessToken);
    }
    setIsReady(true);

    // Keep sessions in sync across tabs: a login/logout in one tab
    // propagates to all other open tabs via the storage event.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = parseStoredSession(e.newValue ?? null);
      if (next && !isJwtExpired(next.accessToken)) {
        setCustomer(next.customer);
        setAccessToken(next.accessToken);
      } else {
        setCustomer(null);
        setAccessToken(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSession = useCallback((session: AuthSession) => {
    setCustomer(session.customer);
    setAccessToken(session.accessToken);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, []);

  const clearSession = useCallback(() => {
    setCustomer(null);
    setAccessToken(null);
    localStorage.removeItem(STORAGE_KEY);
    // Also clear the legacy key in case a migration never ran on this tab.
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshCustomer = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await apiFetch("/api/auth/me", { accessToken });
      if (res.status === 401 || res.status === 403) {
        clearSession();
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { customer: Customer };
      if (data?.customer) {
        setCustomer(data.customer);
        const current = parseStoredSession(localStorage.getItem(STORAGE_KEY));
        if (current) {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              customer: data.customer,
              accessToken: current.accessToken,
            }),
          );
        }
      }
    } catch {
      /* offline / transient — keep stored state */
    }
  }, [accessToken, clearSession]);

  const isAdmin = customer?.role === "admin" && customer.status === "active";

  const value = useMemo(
    () => ({
      customer,
      accessToken,
      isReady,
      isAdmin,
      setSession,
      clearSession,
      refreshCustomer,
    }),
    [
      customer,
      accessToken,
      isReady,
      isAdmin,
      setSession,
      clearSession,
      refreshCustomer,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
