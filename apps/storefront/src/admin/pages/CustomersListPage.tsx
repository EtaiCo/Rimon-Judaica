import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  CustomerRole,
  CustomerStatus,
} from "@rimon/shared-types";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { LoadingState, ErrorState } from "../components/ErrorState";
import { Badge } from "../components/Badge";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { formatDateTime } from "../lib/format";
import styles from "./common.module.css";

type CustomerRow = {
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

type ListResponse = {
  users: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
};

export function CustomersListPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"" | CustomerRole>("");
  const [status, setStatus] = useState<"" | CustomerStatus>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const navigate = useNavigate();

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return `/api/admin/users?${params.toString()}`;
  }, [q, role, status, page]);

  const { data, loading, error } = useAdminFetch<ListResponse>(path);

  return (
    <>
      <PageHeader
        title="ניהול משתמשים"
        description="חיפוש וטיפול בלקוחות. פעולות רגישות דורשות אישור סיסמה."
      />

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="חיפוש לפי אימייל, שם או טלפון…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={styles.select}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as "" | CustomerRole);
            setPage(1);
          }}
        >
          <option value="">כל התפקידים</option>
          <option value="customer">לקוח</option>
          <option value="admin">מנהל</option>
        </select>
        <select
          className={styles.select}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | CustomerStatus);
            setPage(1);
          }}
        >
          <option value="">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="suspended">מושהה</option>
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <DataTable
          rows={data?.users ?? []}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/admin/customers/${r.id}`)}
          pagination={{
            page,
            pageSize,
            total: data?.total ?? 0,
            onPageChange: setPage,
          }}
          columns={[
            {
              key: "name",
              header: "שם",
              render: (r) => r.full_name || "—",
            },
            {
              key: "email",
              header: "אימייל",
              render: (r) => <span dir="ltr">{r.email}</span>,
            },
            {
              key: "phone",
              header: "טלפון",
              render: (r) => <span dir="ltr">{r.phone}</span>,
            },
            {
              key: "role",
              header: "תפקיד",
              render: (r) => (
                <Badge variant={r.role === "admin" ? "info" : "muted"}>
                  {r.role === "admin" ? "מנהל" : "לקוח"}
                </Badge>
              ),
            },
            {
              key: "status",
              header: "סטטוס",
              render: (r) => (
                <Badge variant={r.status === "active" ? "success" : "danger"}>
                  {r.status === "active" ? "פעיל" : "מושהה"}
                </Badge>
              ),
            },
            {
              key: "last",
              header: "התחברות אחרונה",
              render: (r) => formatDateTime(r.last_login),
            },
          ]}
        />
      )}
    </>
  );
}
