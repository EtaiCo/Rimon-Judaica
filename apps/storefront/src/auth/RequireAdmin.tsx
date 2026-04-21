import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { apiFetch } from "../lib/api";

type VerifyState = "pending" | "ok" | "unauthorized" | "forbidden";

/**
 * Server-authoritative admin gate. Client-side `isAdmin` is only used
 * to short-circuit obvious redirects — the actual authorisation comes
 * from a `GET /api/admin/me` probe. Children never render until the
 * server has confirmed admin status. Any HTTP 401 clears the session;
 * 403 sends the user back to `/` with a Hebrew toast.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { accessToken, isReady, isAdmin, clearSession } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<VerifyState>("pending");

  useEffect(() => {
    if (!isReady) return;
    if (!accessToken) {
      setState("unauthorized");
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch("/api/admin/me", { accessToken });
        if (cancelled) return;
        if (res.status === 401) {
          clearSession();
          setState("unauthorized");
          return;
        }
        if (res.status === 403) {
          setState("forbidden");
          return;
        }
        if (res.ok) {
          setState("ok");
          return;
        }
        setState("forbidden");
      } catch {
        if (!cancelled) setState("forbidden");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, isReady, clearSession]);

  if (!isReady || state === "pending") {
    return <AdminGateSkeleton />;
  }

  if (state === "unauthorized") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (state === "forbidden") {
    toast.error("אין הרשאה לאזור הניהול.");
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    // Server said OK; keep rendering. This line is defensive only.
    return <>{children}</>;
  }

  return <>{children}</>;
}

function AdminGateSkeleton() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-xl, 32px)",
        color: "var(--color-text-muted, #777)",
      }}
    >
      טוען ניהול…
    </div>
  );
}
