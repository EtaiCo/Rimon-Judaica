export const currency = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 2,
});

export function formatCurrency(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return currency.format(n);
}

const shortDate = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
});

const longDate = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "—";
  return shortDate.format(d);
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "—";
  return longDate.format(d);
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "ממתינה",
  paid: "שולמה",
  preparing: "בהכנה",
  shipped: "נשלחה",
  delivered: "נמסרה",
  cancelled: "בוטלה",
  refunded: "הוחזרה",
};

export function orderStatusLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return ORDER_STATUS_LABELS[s] ?? s;
}

export function orderStatusVariant(
  s: string | null | undefined,
): "success" | "warn" | "danger" | "info" | "muted" {
  switch (s) {
    case "delivered":
      return "success";
    case "shipped":
    case "paid":
      return "info";
    case "preparing":
    case "pending":
      return "warn";
    case "cancelled":
    case "refunded":
      return "danger";
    default:
      return "muted";
  }
}
