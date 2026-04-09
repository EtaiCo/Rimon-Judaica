import { useState, type SubmitEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import type { CustomerType } from "@rimon/shared-types";
import { Layout } from "../components/Layout/Layout";
import { useAuth } from "../auth/AuthContext";
import shared from "./authShared.module.css";
import regStyles from "./RegisterPage.module.css";

const PHONE_DIGITS_REGEX = /^[0-9]{9,10}$/;

const PASSWORD_POLICY_ERROR =
  "הסיסמה חייבת להכיל לפחות 8 תווים, כולל אות באנגלית ומספר אחד";

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function passwordCriteriaMet(password: string): {
  lengthOk: boolean;
  letterOk: boolean;
  digitOk: boolean;
} {
  return {
    lengthOk: password.length >= 8,
    letterOk: /[A-Za-z]/.test(password),
    digitOk: /[0-9]/.test(password),
  };
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function RegisterPage() {
  const { customer, isReady, setSession } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("private");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (isReady && customer) {
    return <Navigate to="/" replace />;
  }

  const pwdCriteria = passwordCriteriaMet(password);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const nameTrim = fullName.trim();
    if (nameTrim.length < 2) {
      setError("יש להזין שם מלא (לפחות שני תווים).");
      return;
    }

    const phoneDigits = normalizePhone(phone);
    if (!phoneDigits || !PHONE_DIGITS_REGEX.test(phoneDigits)) {
      setError("מספר הטלפון חייב להכיל 9 או 10 ספרות.");
      return;
    }

    if (!isStrongPassword(password)) {
      setError(PASSWORD_POLICY_ERROR);
      return;
    }

    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: nameTrim,
          email: email.trim(),
          phone: phoneDigits,
          password,
          customer_type: customerType,
        }),
      });
      const data = (await res.json()) as {
        customer?: unknown;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "אירעה שגיאה. נסו שוב.");
        return;
      }
      if (
        !data.customer ||
        typeof data.customer !== "object" ||
        data.customer === null
      ) {
        setError("תגובת השרת אינה תקינה.");
        return;
      }
      const c = data.customer as Record<string, unknown>;
      setSession({
        id: String(c.id),
        full_name: typeof c.full_name === "string" ? c.full_name : nameTrim,
        email: String(c.email),
        phone: String(c.phone),
        customer_type: c.customer_type as CustomerType,
        created_at: String(c.created_at),
        last_login:
          typeof c.last_login === "string" ? c.last_login : undefined,
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
          <h1 className={shared.title}>הרשמה</h1>
          <form className={shared.form} onSubmit={handleSubmit} noValidate>
            {error && (
              <div className={shared.feedbackError} role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className={shared.feedbackSuccess} role="status">
                נרשמתם בהצלחה. מעבירים לדף הבית…
              </div>
            )}
            <div className={shared.field}>
              <label className={shared.label} htmlFor="reg-fullname">
                שם מלא
              </label>
              <input
                id="reg-fullname"
                className={shared.input}
                type="text"
                name="full_name"
                autoComplete="name"
                placeholder="ישראל ישראלי"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading || success}
              />
            </div>
            <div className={shared.field}>
              <label className={shared.label} htmlFor="reg-email">
                אימייל
              </label>
              <input
                id="reg-email"
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
              <label className={shared.label} htmlFor="reg-phone">
                טלפון
              </label>
              <input
                id="reg-phone"
                className={shared.input}
                type="tel"
                name="phone"
                autoComplete="tel"
                placeholder="0501234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading || success}
                dir="ltr"
              />
            </div>
            <fieldset className={shared.fieldset}>
              <legend className={shared.legend}>סוג לקוח</legend>
              <div className={shared.radioRow}>
                <label className={shared.radioLabel}>
                  <span>פרטי</span>
                  <input
                    className={shared.radio}
                    type="radio"
                    name="customer_type"
                    value="private"
                    checked={customerType === "private"}
                    onChange={() => setCustomerType("private")}
                    disabled={loading || success}
                  />
                </label>
                <label className={shared.radioLabel}>
                  <span>סיטונאי</span>
                  <input
                    className={shared.radio}
                    type="radio"
                    name="customer_type"
                    value="wholesale"
                    checked={customerType === "wholesale"}
                    onChange={() => setCustomerType("wholesale")}
                    disabled={loading || success}
                  />
                </label>
              </div>
            </fieldset>
            <div className={shared.field}>
              <label className={shared.label} htmlFor="reg-password">
                סיסמה
              </label>
              <input
                id="reg-password"
                className={shared.input}
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="לפחות 8 תווים, אות אנגלית ומספר"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || success}
                aria-describedby="reg-password-hint"
              />
              <p className={regStyles.passwordHint} id="reg-password-hint">
                לפחות 8 תווים, כולל אות באנגלית (A–Z) ומספר אחד.
              </p>
              <div
                className={regStyles.strengthMeter}
                role="presentation"
                aria-hidden
              >
                <span
                  className={
                    pwdCriteria.lengthOk
                      ? `${regStyles.strengthBar} ${regStyles.strengthBarActive}`
                      : regStyles.strengthBar
                  }
                />
                <span
                  className={
                    pwdCriteria.letterOk
                      ? `${regStyles.strengthBar} ${regStyles.strengthBarActive}`
                      : regStyles.strengthBar
                  }
                />
                <span
                  className={
                    pwdCriteria.digitOk
                      ? `${regStyles.strengthBar} ${regStyles.strengthBarActive}`
                      : regStyles.strengthBar
                  }
                />
              </div>
            </div>
            <div className={shared.field}>
              <label className={shared.label} htmlFor="reg-confirm">
                אימות סיסמה
              </label>
              <input
                id="reg-confirm"
                className={shared.input}
                type="password"
                name="confirm_password"
                autoComplete="new-password"
                placeholder="הזינו שוב את הסיסמה"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || success}
              />
            </div>
            <button
              type="submit"
              className={shared.buttonPrimary}
              disabled={loading || success}
            >
              {loading ? "נרשמים…" : "הרשמה"}
            </button>
          </form>
          <div className={shared.footerLinks}>
            <Link className={shared.link} to="/login">
              כבר רשומים? להתחברות
            </Link>
            <Link className={shared.ghostExit} to="/">
              <span aria-hidden>←</span>
              המשך ללא הרשמה
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
