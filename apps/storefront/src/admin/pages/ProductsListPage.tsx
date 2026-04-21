import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { LoadingState, ErrorState } from "../components/ErrorState";
import { Badge } from "../components/Badge";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { adminApi } from "../api/client";
import { formatDate } from "../lib/format";
import styles from "./common.module.css";

type NamedRef = { id: string; name: string; slug: string } | null;

type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  images: string[];
  is_active: boolean;
  category_id: string;
  sub_category_id: string | null;
  created_at: string;
  categories?: NamedRef;
  sub_categories?: NamedRef;
};

type ListResponse = {
  products: AdminProductRow[];
  total: number;
  page: number;
  pageSize: number;
};

type CategoryRow = {
  id: string;
  name: string;
  parent_id: string | null;
};

type SubCategoryRow = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
};

function storefrontUrlForProduct(productId: string): string {
  const base =
    (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.replace(
      /\/$/,
      "",
    ) ?? "";
  return `${base}/product/${productId}`;
}

export function ProductsListPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "true" | "false">("");
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const navigate = useNavigate();
  const { accessToken } = useAdminAuth();

  const categories = useAdminFetch<CategoryRow[]>(`/api/admin/categories`);
  const [subCategories, setSubCategories] = useState<SubCategoryRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!categoryId) {
      setSubCategories([]);
      return;
    }
    adminApi
      .get<SubCategoryRow[]>(
        accessToken,
        `/api/admin/sub-categories?categoryId=${encodeURIComponent(categoryId)}`,
      )
      .then((rows) => {
        if (!cancelled) setSubCategories(rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setSubCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId, accessToken]);

  const categoryOptions = useMemo(
    () => (categories.data ?? []).filter((c) => c.parent_id === null),
    [categories.data],
  );

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("isActive", status);
    if (categoryId) params.set("categoryId", categoryId);
    if (subCategoryId) params.set("subCategoryId", subCategoryId);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return `/api/admin/products?${params.toString()}`;
  }, [q, status, categoryId, subCategoryId, page]);

  const { data, loading, error } = useAdminFetch<ListResponse>(path);

  return (
    <>
      <PageHeader
        title="ניהול מוצרים"
        description="חיפוש, סינון, ויצירת מוצרים חדשים."
        actions={
          <Link to="/admin/products/new" className={`${styles.btn} ${styles.btnPrimary}`}>
            מוצר חדש
          </Link>
        }
      />

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="חיפוש לפי שם מוצר…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={styles.select}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setSubCategoryId("");
            setPage(1);
          }}
        >
          <option value="">כל הקטגוריות</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={subCategoryId}
          onChange={(e) => {
            setSubCategoryId(e.target.value);
            setPage(1);
          }}
          disabled={!categoryId || subCategories.length === 0}
        >
          <option value="">כל תתי-הקטגוריות</option>
          {subCategories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | "true" | "false");
            setPage(1);
          }}
        >
          <option value="">כל הסטטוסים</option>
          <option value="true">פעיל</option>
          <option value="false">לא פעיל</option>
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <DataTable<AdminProductRow>
          rows={data?.products ?? []}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/admin/products/${r.id}`)}
          pagination={{
            page,
            pageSize,
            total: data?.total ?? 0,
            onPageChange: setPage,
          }}
          columns={[
            {
              key: "image",
              header: "תמונה",
              width: 64,
              render: (r) => (
                <img
                  src={r.images?.[0] ?? "/placeholder.svg"}
                  alt=""
                  className={styles.imageThumb}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility =
                      "hidden";
                  }}
                />
              ),
            },
            { key: "name", header: "שם", render: (r) => r.name },
            {
              key: "path",
              header: "קטגוריה",
              render: (r) => {
                const cat = r.categories?.name ?? "—";
                const sub = r.sub_categories?.name;
                return (
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    {cat}
                    {sub ? ` › ${sub}` : ""}
                  </span>
                );
              },
            },
            { key: "slug", header: "מזהה כתובת", render: (r) => <code>{r.slug}</code> },
            {
              key: "active",
              header: "סטטוס",
              render: (r) => (
                <Badge variant={r.is_active ? "success" : "muted"}>
                  {r.is_active ? "פעיל" : "לא פעיל"}
                </Badge>
              ),
            },
            {
              key: "created",
              header: "נוצר",
              render: (r) => formatDate(r.created_at),
            },
            {
              key: "storefront",
              header: "",
              width: 56,
              render: (r) => (
                <a
                  href={storefrontUrlForProduct(r.id)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.btn}
                  aria-label="צפייה בחנות"
                  title="צפייה בחנות"
                  onClick={(e) => e.stopPropagation()}
                >
                  ↗
                </a>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
