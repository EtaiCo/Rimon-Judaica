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

const STORAGE_KEY = "rimon_session";

export interface AuthSession {
  customer: Customer;
  accessToken: string;
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
        created_at: co.created_at,
        last_login:
          typeof co.last_login === "string" ? co.last_login : undefined,
      },
    };
  } catch {
    return null;
  }
}

interface AuthContextValue {
  customer: Customer | null;
  accessToken: string | null;
  isReady: boolean;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = parseStoredSession(sessionStorage.getItem(STORAGE_KEY));
    if (stored) {
      setCustomer(stored.customer);
      setAccessToken(stored.accessToken);
    }
    setIsReady(true);
  }, []);

  const setSession = useCallback((session: AuthSession) => {
    setCustomer(session.customer);
    setAccessToken(session.accessToken);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, []);

  const clearSession = useCallback(() => {
    setCustomer(null);
    setAccessToken(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      customer,
      accessToken,
      isReady,
      setSession,
      clearSession,
    }),
    [customer, accessToken, isReady, setSession, clearSession],
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
