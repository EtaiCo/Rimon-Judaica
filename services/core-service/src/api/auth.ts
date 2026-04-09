import { Router, type Router as RouterType } from "express";
import type { Customer, CustomerType } from "@rimon/shared-types";
import { getSupabaseAdmin } from "../config/supabase.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

const router: RouterType = Router();

const EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_DIGITS_REGEX = /^[0-9]{9,10}$/;

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isCustomerType(v: unknown): v is CustomerType {
  return v === "private" || v === "wholesale";
}

router.post("/register", async (req, res) => {
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
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const customerType: CustomerType = isCustomerType(body.customer_type)
    ? body.customer_type
    : "private";

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

  if (password.length < 8) {
    res
      .status(400)
      .json({ error: "הסיסמה חייבת להכיל לפחות 8 תווים." });
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
      email,
      phone: phoneDigits,
      customer_type: customerType,
      password_hash,
    })
    .select("id, email, phone, customer_type, created_at, last_login")
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

  const customer: Customer = {
    id: data.id,
    email: data.email,
    phone: data.phone,
    customer_type: data.customer_type as CustomerType,
    created_at: data.created_at,
    last_login: data.last_login ?? undefined,
  };

  res.status(201).json({ customer });
});

router.post("/login", async (req, res) => {
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
      "id, email, phone, customer_type, created_at, last_login, password_hash",
    )
    .eq("email", email)
    .maybeSingle();

  if (fetchErr) {
    res.status(500).json({ error: fetchErr.message });
    return;
  }

  if (!row) {
    res.status(401).json({ error: "אימייל או סיסמה שגויים." });
    return;
  }

  const ok = await verifyPassword(password, row.password_hash as string);
  if (!ok) {
    res.status(401).json({ error: "אימייל או סיסמה שגויים." });
    return;
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("customers")
    .update({ last_login: nowIso })
    .eq("id", row.id)
    .select("id, email, phone, customer_type, created_at, last_login")
    .single();

  if (updateErr) {
    res.status(500).json({ error: updateErr.message });
    return;
  }

  const customer: Customer = {
    id: updated.id,
    email: updated.email,
    phone: updated.phone,
    customer_type: updated.customer_type as CustomerType,
    created_at: updated.created_at,
    last_login: updated.last_login ?? undefined,
  };

  res.json({ customer });
});

export default router;
