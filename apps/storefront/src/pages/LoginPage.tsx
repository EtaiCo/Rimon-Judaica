import { useState, type SubmitEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout/Layout";
import { useAuth } from "../auth/AuthContext";
import shared from "./authShared.module.css";
import "./LoginPage.module.css";

export function LoginPage() {
  const { customer, isReady, setSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (isReady && customer) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json()) as {
        customer?: unknown;
        accessToken?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "אירעה שגיאה. נסו שוב.");
        return;
      }
      if (
        !data.customer ||
        typeof data.customer !== "object" ||
        data.customer === null ||
        typeof data.accessToken !== "string" ||
        !data.accessToken.trim()
      ) {
        setError("תגובת השרת אינה תקינה.");
        return;
      }
      const c = data.customer as Record<string, unknown>;
      setSession({
        accessToken: data.accessToken.trim(),
        customer: {
          id: String(c.id),
          full_name: typeof c.full_name === "string" ? c.full_name : "",
          email: String(c.email),
          phone: String(c.phone),
          customer_type: c.customer_type as "private" | "wholesale",
          created_at: String(c.created_at),
          last_login:
            typeof c.last_login === "string" ? c.last_login : undefined,
        },
      });
      setSuccess(true);
      window.setTimeout(() => navigate("/", { replace: true }), 1100);
    } catch {
      setError("לא ניתן להתחבר לשרת. בדקו את החיבור.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className={shared.page}>
        <div className={shared.card}>
          <h1 className={shared.title}>התחברות</h1>
          <form className={shared.form} onSubmit={handleSubmit} noValidate>
            {error && (
              <div className={shared.feedbackError} role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className={shared.feedbackSuccess} role="status">
                התחברתם בהצלחה. מעבירים לדף הבית…
              </div>
            )}
            <div className={shared.field}>
              <label className={shared.label} htmlFor="login-email">
                אימייל
              </label>
              <input
                id="login-email"
                className={shared.input}
                type="email"
                name="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || success}
                dir="ltr"
              />
            </div>
            <div className={shared.field}>
              <label className={shared.label} htmlFor="login-password">
                סיסמה
              </label>
              <input
                id="login-password"
                className={shared.input}
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || success}
              />
            </div>
            <button
              type="submit"
              className={shared.buttonPrimary}
              disabled={loading || success}
            >
              {loading ? "מתחברים…" : "התחברות"}
            </button>
          </form>
          <div className={shared.footerLinks}>
            <Link className={shared.link} to="/register">
              עדיין לא רשומים? להרשמה
            </Link>
            <Link className={shared.ghostExit} to="/">
              <span aria-hidden>←</span>
              המשך ללא התחברות
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
