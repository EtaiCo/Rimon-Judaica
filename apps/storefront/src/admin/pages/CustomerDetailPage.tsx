import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import type {
  CustomerRole,
  CustomerStatus,
  OrderStatus,
} from "@rimon/shared-types";
import { PageHeader } from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/ErrorState";
import { Badge } from "../components/Badge";
import { DataTable } from "../components/DataTable";
import { SudoPasswordDialog } from "../components/SudoPasswordDialog";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { adminApi, AdminApiError } from "../api/client";
import {
  formatCurrency,
  formatDateTime,
  orderStatusLabel,
  orderStatusVariant,
} from "../lib/format";
import styles from "./common.module.css";

type CustomerDetailResponse = {
  user: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    customer_type: string;
    role: CustomerRole;
    status: CustomerStatus;
    created_at: string;
    last_login: string | null;
  };
  orders: Array<{
    id: string;
    invoice_number: string;
    status: OrderStatus;
    total_amount: number | string;
    created_at: string;
  }>;
  totalSpend: number;
  ordersCount: number;
};

type SudoActionKind = "suspend" | "activate" | "promote" | "demote" | "delete";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken, customer: me } = useAdminAuth();
  const detail = useAdminFetch<CustomerDetailResponse>(
    id ? `/api/admin/users/${id}` : null,
  );

  const [sudoKind, setSudoKind] = useState<SudoActionKind | null>(null);

  if (detail.loading || !id) return <LoadingState />;
  if (detail.error) return <ErrorState message={detail.error} />;
  if (!detail.data) return <ErrorState message="המשתמש לא נמצא." />;

  const { user, orders, totalSpend, ordersCount } = detail.data;
  const isSelf = me?.id === user.id;

  async function perform(kind: SudoActionKind, sudoPassword: string) {
    if (!id) return;
    try {
      if (kind === "suspend") {
        await adminApi.patch(
          accessToken,
          `/api/admin/users/${id}/status`,
          { status: "suspended" },
          { sudoPassword },
        );
      } else if (kind === "activate") {
        await adminApi.patch(
          accessToken,
          `/api/admin/users/${id}/status`,
          { status: "active" },
          { sudoPassword },
        );
      } else if (kind === "promote") {
        await adminApi.patch(
          accessToken,
          `/api/admin/users/${id}/role`,
          { role: "admin" },
          { sudoPassword },
        );
      } else if (kind === "demote") {
        await adminApi.patch(
          accessToken,
          `/api/admin/users/${id}/role`,
          { role: "customer" },
          { sudoPassword },
        );
      } else if (kind === "delete") {
        await adminApi.del(accessToken, `/api/admin/users/${id}`, {
          sudoPassword,
        });
        navigate("/admin/customers", { replace: true });
        return;
      }
      detail.refresh();
      setSudoKind(null);
    } catch (e) {
      const msg =
        e instanceof AdminApiError ? e.message : "שגיאה בביצוע הפעולה.";
      throw new Error(msg);
    }
  }

  return (
    <>
      <PageHeader
        title={user.full_name || user.email}
        description={`לקוח מאז ${formatDateTime(user.created_at)}`}
        actions={
          <Link to="/admin/customers" className={styles.btn}>
            ← חזרה לרשימה
          </Link>
        }
      />

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
          <dl className={styles.kvList}>
            <dt>אימייל</dt>
            <dd dir="ltr">{user.email}</dd>
            <dt>טלפון</dt>
            <dd dir="ltr">{user.phone}</dd>
            <dt>סוג</dt>
            <dd>{user.customer_type}</dd>
            <dt>תפקיד</dt>
            <dd>
              <Badge variant={user.role === "admin" ? "info" : "muted"}>
                {user.role === "admin" ? "מנהל" : "לקוח"}
              </Badge>
            </dd>
            <dt>סטטוס</dt>
            <dd>
              <Badge variant={user.status === "active" ? "success" : "danger"}>
                {user.status === "active" ? "פעיל" : "מושהה"}
              </Badge>
            </dd>
            <dt>התחברות אחרונה</dt>
            <dd>{formatDateTime(user.last_login)}</dd>
          </dl>
          <dl className={styles.kvList}>
            <dt>סה״כ רכישות</dt>
            <dd>
              <strong>{formatCurrency(totalSpend)}</strong>
            </dd>
            <dt>הזמנות</dt>
            <dd>{ordersCount.toLocaleString("he-IL")}</dd>
          </dl>
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {user.status === "active" ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => setSudoKind("suspend")}
              disabled={isSelf}
              title={isSelf ? "לא ניתן להשעות את עצמך" : undefined}
            >
              השעה משתמש
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setSudoKind("activate")}
            >
              הפעל מחדש
            </button>
          )}
          {user.role === "admin" ? (
            <button
              type="button"
              className={styles.btn}
              onClick={() => setSudoKind("demote")}
              disabled={isSelf}
              title={isSelf ? "לא ניתן להוריד את עצמך" : undefined}
            >
              הורד מניהול
            </button>
          ) : (
            <button
              type="button"
              className={styles.btn}
              onClick={() => setSudoKind("promote")}
            >
              הפוך למנהל
            </button>
          )}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => setSudoKind("delete")}
            disabled={isSelf}
            title={isSelf ? "לא ניתן למחוק את עצמך" : undefined}
          >
            מחק חשבון
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>הזמנות אחרונות</h3>
        <DataTable
          rows={orders}
          rowKey={(r) => r.id}
          emptyLabel="אין הזמנות."
          onRowClick={(r) => navigate(`/admin/orders/${r.id}`)}
          columns={[
            {
              key: "invoice",
              header: "חשבונית",
              render: (r) => <strong>{r.invoice_number}</strong>,
            },
            {
              key: "date",
              header: "תאריך",
              render: (r) => formatDateTime(r.created_at),
            },
            {
              key: "status",
              header: "סטטוס",
              render: (r) => (
                <Badge variant={orderStatusVariant(r.status)}>
                  {orderStatusLabel(r.status)}
                </Badge>
              ),
            },
            {
              key: "total",
              header: "סה״כ",
              render: (r) => formatCurrency(r.total_amount),
            },
          ]}
        />
      </div>

      <SudoPasswordDialog
        open={sudoKind !== null}
        onOpenChange={(next) => {
          if (!next) setSudoKind(null);
        }}
        title={sudoActionTitle(sudoKind)}
        description={sudoActionDescription(sudoKind, user.full_name || user.email)}
        confirmLabel={sudoActionLabel(sudoKind)}
        destructive={sudoKind === "delete" || sudoKind === "suspend"}
        onConfirm={(password) => sudoKind ? perform(sudoKind, password) : Promise.resolve()}
      />
    </>
  );
}

function sudoActionTitle(k: SudoActionKind | null): string {
  switch (k) {
    case "suspend":
      return "השעיית משתמש";
    case "activate":
      return "הפעלת משתמש";
    case "promote":
      return "קידום לניהול";
    case "demote":
      return "הורדה מניהול";
    case "delete":
      return "מחיקת חשבון";
    default:
      return "אישור פעולה";
  }
}

function sudoActionLabel(k: SudoActionKind | null): string {
  switch (k) {
    case "suspend":
      return "השעה";
    case "activate":
      return "הפעל";
    case "promote":
      return "קדם למנהל";
    case "demote":
      return "הורד";
    case "delete":
      return "מחק";
    default:
      return "אשר";
  }
}

function sudoActionDescription(k: SudoActionKind | null, name: string) {
  const base = `פעולה זו מבוצעת על “${name}” ודורשת אישור סיסמה.`;
  switch (k) {
    case "suspend":
      return `${base} המשתמש לא יוכל להתחבר וכל הטוקנים הפעילים יבוטלו.`;
    case "promote":
      return `${base} המשתמש יקבל הרשאות ניהול מלאות.`;
    case "demote":
      return `${base} הסרת הרשאות ניהול תחולי באופן מיידי.`;
    case "delete":
      return `${base} אם קיימות הזמנות היסטוריות, החשבון יושעה במקום להימחק.`;
    default:
      return base;
  }
}
