import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Customer } from "@rimon/shared-types";

const STORAGE_KEY = "rimon_customer";

function parseStoredCustomer(raw: string | null): Customer | null {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (
      typeof o.id !== "string" ||
      typeof o.email !== "string" ||
      typeof o.phone !== "string" ||
      typeof o.customer_type !== "string" ||
      typeof o.created_at !== "string"
    ) {
      return null;
    }
    return {
      id: o.id,
      full_name: typeof o.full_name === "string" ? o.full_name : "",
      email: o.email,
      phone: o.phone,
      customer_type: o.customer_type as Customer["customer_type"],
      created_at: o.created_at,
      last_login: typeof o.last_login === "string" ? o.last_login : undefined,
    };
  } catch {
    return null;
  }
}

interface AuthContextValue {
  customer: Customer | null;
  isReady: boolean;
  setSession: (customer: Customer) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = parseStoredCustomer(sessionStorage.getItem(STORAGE_KEY));
    setCustomer(stored);
    setIsReady(true);
  }, []);

  const setSession = useCallback((next: Customer) => {
    setCustomer(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clearSession = useCallback(() => {
    setCustomer(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ customer, isReady, setSession, clearSession }),
    [customer, isReady, setSession, clearSession],
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
