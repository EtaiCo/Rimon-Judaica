import { Router, type Router as RouterType } from "express";
import type {
  Customer,
  CustomerRole,
  CustomerStatus,
  CustomerType,
} from "@rimon/shared-types";
import { getSupabaseAdmin } from "../config/supabase.js";
import { signCustomerAccessToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { requireCustomerAuth, authLimiter } from "../middleware/index.js";
import { logAuthEvent, logSecurityEvent } from "../lib/securityLog.js";

const router: RouterType = Router();

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_DIGITS_REGEX = /^[0-9]{9,10}$/;

const PASSWORD_POLICY_HE =
  "הסיסמה חייבת להכיל לפחות 8 תווים, כולל אות באנגלית ומספר אחד";

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isCustomerType(v: unknown): v is CustomerType {
  return v === "private" || v === "wholesale";
}

function isCustomerRole(v: unknown): v is CustomerRole {
  return v === "customer" || v === "admin";
}

function isCustomerStatus(v: unknown): v is CustomerStatus {
  return v === "active" || v === "suspended";
}

router.post("/register", authLimiter, async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const fullNameRaw =
    typeof body.full_name === "string" ? body.full_name.trim() : "";
  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const customerType: CustomerType = isCustomerType(body.customer_type)
    ? body.customer_type
    : "private";

  if (fullNameRaw.length < 2) {
    res.status(400).json({ error: "יש להזין שם מלא (לפחות שני תווים)." });
    return;
  }

  if (!emailRaw || !EMAIL_REGEX.test(emailRaw)) {
    res.status(400).json({ error: "כתובת האימייל אינה תקינה." });
    return;
  }

  const phoneDigits = normalizePhone(phoneRaw);
  if (!phoneDigits || !PHONE_DIGITS_REGEX.test(phoneDigits)) {
    res
      .status(400)
      .json({ error: "מספר הטלפון חייב להכיל 9 או 10 ספרות." });
    return;
  }

  if (!isStrongPassword(password)) {
    res.status(400).json({ error: PASSWORD_POLICY_HE });
    return;
  }

  const email = emailRaw.toLowerCase();
  let password_hash: string;
  try {
    password_hash = await hashPassword(password);
  } catch {
    res.status(500).json({ error: "שגיאה בעיבוד הסיסמה. נסו שוב מאוחר יותר." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert({
      full_name: fullNameRaw,
      email,
      phone: phoneDigits,
      customer_type: customerType,
      password_hash,
    })
    .select(
      "id, full_name, email, phone, customer_type, role, status, jwt_version, created_at, last_login",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      res.status(409).json({ error: "כתובת האימייל כבר רשומה במערכת." });
      return;
    }
    if (error.code === "23514") {
      res.status(400).json({ error: "הנתונים שסופקו אינם עומדים בדרישות." });
      return;
    }
    res.status(500).json({ error: error.message });
    return;
  }

  const role: CustomerRole = isCustomerRole(data.role) ? data.role : "customer";
  const status: CustomerStatus = isCustomerStatus(data.status)
    ? data.status
    : "active";

  const customer: Customer = {
    id: data.id,
    full_name: data.full_name ?? "",
    email: data.email,
    phone: data.phone,
    customer_type: data.customer_type as CustomerType,
    role,
    status,
    created_at: data.created_at,
    last_login: data.last_login ?? undefined,
  };

  let accessToken: string;
  try {
    const signed = signCustomerAccessToken(
      customer.id,
      Number(data.jwt_version) || 1,
      { isAdmin: role === "admin" },
    );
    accessToken = signed.token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  await logAuthEvent(req, {
    kind: "register",
    customerId: customer.id,
    email: customer.email,
  });

  res.status(201).json({ customer, accessToken });
});

router.post("/login", authLimiter, async (req, res) => {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!emailRaw || !EMAIL_REGEX.test(emailRaw)) {
    res.status(400).json({ error: "כתובת האימייל אינה תקינה." });
    return;
  }

  if (!password) {
    res.status(400).json({ error: "יש להזין סיסמה." });
    return;
  }

  const email = emailRaw.toLowerCase();

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("customers")
    .select(
      "id, full_name, email, phone, customer_type, role, status, jwt_version, created_at, last_login, password_hash",
    )
    .eq("email", email)
    .maybeSingle();

  if (fetchErr) {
    res.status(500).json({ error: fetchErr.message });
    return;
  }

  if (!row) {
    await logAuthEvent(req, { kind: "login_fail", email });
    res.status(401).json({ error: "אימייל או סיסמה שגויים." });
    return;
  }

  const ok = await verifyPassword(password, row.password_hash as string);
  if (!ok) {
    await logAuthEvent(req, {
      kind: "login_fail",
      email,
      customerId: row.id as string,
    });
    res.status(401).json({ error: "אימייל או סיסמה שגויים." });
    return;
  }

  const status: CustomerStatus = isCustomerStatus(row.status)
    ? row.status
    : "active";

  if (status !== "active") {
    await logSecurityEvent(req, {
      kind: "login_blocked_suspended",
      severity: "warn",
      customerId: row.id as string,
      meta: { email },
    });
    res.status(403).json({ error: "החשבון מושעה. פנו לתמיכה." });
    return;
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("customers")
    .update({ last_login: nowIso })
    .eq("id", row.id)
    .select(
      "id, full_name, email, phone, customer_type, role, status, jwt_version, created_at, last_login",
    )
    .single();

  if (updateErr) {
    res.status(500).json({ error: updateErr.message });
    return;
  }

  const role: CustomerRole = isCustomerRole(updated.role) ? updated.role : "customer";

  const customer: Customer = {
    id: updated.id,
    full_name: updated.full_name ?? "",
    email: updated.email,
    phone: updated.phone,
    customer_type: updated.customer_type as CustomerType,
    role,
    status,
    created_at: updated.created_at,
    last_login: updated.last_login ?? undefined,
  };

  let accessToken: string;
  try {
    const signed = signCustomerAccessToken(
      customer.id,
      Number(updated.jwt_version) || 1,
      { isAdmin: role === "admin" },
    );
    accessToken = signed.token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  await logAuthEvent(req, {
    kind: "login_ok",
    customerId: customer.id,
    email: customer.email,
  });

  res.json({ customer, accessToken });
});

/** Returns the live customer row. Used by the frontend after load/refresh. */
router.get("/me", requireCustomerAuth, async (req, res) => {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, full_name, email, phone, customer_type, role, status, created_at, last_login",
    )
    .eq("id", req.customer!.id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "לא נמצא." });
    return;
  }

  const role: CustomerRole = isCustomerRole(data.role) ? data.role : "customer";
  const status: CustomerStatus = isCustomerStatus(data.status)
    ? data.status
    : "active";

  const customer: Customer = {
    id: data.id,
    full_name: data.full_name ?? "",
    email: data.email,
    phone: data.phone,
    customer_type: data.customer_type as CustomerType,
    role,
    status,
    created_at: data.created_at,
    last_login: data.last_login ?? undefined,
  };
  res.json({ customer });
});

/**
 * Logout endpoint. Bumps `jwt_version` so every outstanding token for
 * this customer is invalidated immediately. This is the only way to
 * force-revoke sessions (including a stolen token).
 */
router.post("/logout", requireCustomerAuth, async (req, res) => {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: msg });
    return;
  }

  const { error } = await supabase.rpc("revoke_user_sessions", {
    p_user_id: req.customer!.id,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await logAuthEvent(req, {
    kind: "logout",
    customerId: req.customer!.id,
    email: req.customer!.email,
  });

  res.status(204).end();
});

export default router;
