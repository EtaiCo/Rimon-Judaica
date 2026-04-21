import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/ErrorState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { adminApi, AdminApiError } from "../api/client";
import { formatCurrency, formatDate } from "../lib/format";
import { Badge } from "../components/Badge";
import { DataTable } from "../components/DataTable";
import styles from "./common.module.css";

type NamedRef = { id: string; name: string; slug: string } | null;

type AdminProductDetail = {
  product: {
    id: string;
    category_id: string;
    sub_category_id: string | null;
    name: string;
    slug: string;
    description: string;
    images: string[];
    is_active: boolean;
    seo_title: string | null;
    seo_description: string | null;
    created_at: string;
    updated_at?: string;
    categories?: NamedRef;
    sub_categories?: NamedRef;
  };
  variants: Array<{
    id: string;
    product_id: string;
    variant_name: string;
    price: number | string;
    stock_quantity: number;
    sku: string;
    image_url: string | null;
    size: string | null;
    color: string | null;
    material: string | null;
    low_stock_threshold: number;
    is_active: boolean;
  }>;
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

type ProductFormState = {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  subCategoryId: string;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
  images: string[];
};

const emptyForm: ProductFormState = {
  name: "",
  slug: "",
  description: "",
  categoryId: "",
  subCategoryId: "",
  isActive: true,
  seoTitle: "",
  seoDescription: "",
  images: [],
};

function storefrontUrlForProduct(productId: string): string {
  const base =
    (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.replace(
      /\/$/,
      "",
    ) ?? "";
  return `${base}/product/${productId}`;
}

export function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { accessToken } = useAdminAuth();

  const detail = useAdminFetch<AdminProductDetail>(
    isNew ? null : `/api/admin/products/${id}`,
  );
  const categories = useAdminFetch<CategoryRow[]>(`/api/admin/categories`);

  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [subCategories, setSubCategories] = useState<SubCategoryRow[]>([]);
  const [newImage, setNewImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (detail.data?.product) {
      const p = detail.data.product;
      setForm({
        name: p.name,
        slug: p.slug,
        description: p.description ?? "",
        categoryId: p.category_id,
        subCategoryId: p.sub_category_id ?? "",
        isActive: p.is_active,
        seoTitle: p.seo_title ?? "",
        seoDescription: p.seo_description ?? "",
        images: Array.isArray(p.images) ? p.images : [],
      });
    }
  }, [detail.data]);

  useEffect(() => {
    let cancelled = false;
    if (!form.categoryId) {
      setSubCategories([]);
      return;
    }
    adminApi
      .get<SubCategoryRow[]>(
        accessToken,
        `/api/admin/sub-categories?categoryId=${encodeURIComponent(form.categoryId)}`,
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
  }, [form.categoryId, accessToken]);

  const categoryOptions = useMemo(
    () =>
      (categories.data ?? []).filter((c) => c.parent_id === null),
    [categories.data],
  );

  const breadcrumb = useMemo(() => {
    const p = detail.data?.product;
    if (!p) return null;
    const catName = p.categories?.name ?? null;
    const subName = p.sub_categories?.name ?? null;
    if (!catName && !subName) return null;
    return [catName, subName].filter(Boolean).join(" › ");
  }, [detail.data]);

  function patchForm<K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addImage() {
    const v = newImage.trim();
    if (!v) return;
    setForm((f) => ({ ...f, images: [...f.images, v] }));
    setNewImage("");
  }

  function removeImage(idx: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        categoryId: form.categoryId,
        subCategoryId: form.subCategoryId || null,
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description,
        images: form.images,
        isActive: form.isActive,
        seoTitle: form.seoTitle.trim() || undefined,
        seoDescription: form.seoDescription.trim() || undefined,
      };
      if (isNew) {
        const created = await adminApi.post<{ id: string }>(
          accessToken,
          "/api/admin/products",
          payload,
        );
        navigate(`/admin/products/${created.id}`, { replace: true });
      } else {
        await adminApi.patch(
          accessToken,
          `/api/admin/products/${id}`,
          payload,
        );
        detail.refresh();
      }
    } catch (e) {
      setSaveError(
        e instanceof AdminApiError ? e.message : "שגיאה בשמירת המוצר.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew) return;
    setDeleting(true);
    try {
      await adminApi.del(accessToken, `/api/admin/products/${id}`);
      navigate("/admin/products", { replace: true });
    } catch (e) {
      setSaveError(
        e instanceof AdminApiError ? e.message : "שגיאה במחיקה.",
      );
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const title = isNew ? "מוצר חדש" : detail.data?.product?.name ?? "עריכת מוצר";

  return (
    <>
      <PageHeader
        title={title}
        description={
          isNew
            ? "הוספת מוצר חדש למלאי."
            : breadcrumb ?? "עריכת פרטי המוצר, וריאנטים ומלאי."
        }
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {!isNew && id ? (
              <a
                href={storefrontUrlForProduct(id)}
                target="_blank"
                rel="noreferrer"
                className={styles.btn}
              >
                צפייה בחנות ↗
              </a>
            ) : null}
            <Link to="/admin/products" className={styles.btn}>
              ← חזרה לרשימה
            </Link>
          </div>
        }
      />

      {!isNew && detail.loading ? (
        <LoadingState />
      ) : !isNew && detail.error ? (
        <ErrorState message={detail.error} />
      ) : (
        <>
          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>פרטים בסיסיים</h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>שם המוצר</label>
                <input
                  value={form.name}
                  onChange={(e) => patchForm("name", e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>מזהה כתובת (URL Slug)</label>
                <input
                  value={form.slug}
                  onChange={(e) => patchForm("slug", e.target.value)}
                  dir="ltr"
                  placeholder="my-product"
                  required
                />
              </div>
              <div className={styles.field}>
                <label>קטגוריה</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setForm((f) => ({
                      ...f,
                      categoryId: next,
                      subCategoryId: "",
                    }));
                  }}
                >
                  <option value="" disabled>
                    בחר קטגוריה…
                  </option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>תת-קטגוריה (אופציונלי)</label>
                <select
                  value={form.subCategoryId}
                  onChange={(e) => patchForm("subCategoryId", e.target.value)}
                  disabled={!form.categoryId || subCategories.length === 0}
                >
                  <option value="">ללא תת-קטגוריה</option>
                  {subCategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>סטטוס</label>
                <select
                  value={form.isActive ? "true" : "false"}
                  onChange={(e) =>
                    patchForm("isActive", e.target.value === "true")
                  }
                >
                  <option value="true">פעיל</option>
                  <option value="false">לא פעיל (מוסתר)</option>
                </select>
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label>תיאור</label>
                <textarea
                  value={form.description}
                  onChange={(e) => patchForm("description", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>תמונות</h3>
            <div className={styles.inputAdd}>
              <input
                type="url"
                value={newImage}
                placeholder="https://…"
                dir="ltr"
                onChange={(e) => setNewImage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addImage();
                  }
                }}
              />
              <button type="button" className={styles.btn} onClick={addImage}>
                הוסף
              </button>
            </div>
            <div className={styles.imageList}>
              {form.images.length === 0 ? (
                <span style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>
                  אין תמונות. הוסף לפחות אחת.
                </span>
              ) : (
                form.images.map((url, idx) => (
                  <span key={`${url}-${idx}`} className={styles.imageChip}>
                    <img src={url} alt="" />
                    <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {url}
                    </span>
                    <button
                      type="button"
                      className={styles.imageChipRemove}
                      onClick={() => removeImage(idx)}
                      aria-label="הסר"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>קידום במנועי חיפוש</h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>כותרת לקידום (SEO)</label>
                <input
                  value={form.seoTitle}
                  onChange={(e) => patchForm("seoTitle", e.target.value)}
                />
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label>תיאור לקידום (SEO)</label>
                <textarea
                  value={form.seoDescription}
                  onChange={(e) => patchForm("seoDescription", e.target.value)}
                />
              </div>
            </div>
          </div>

          {saveError ? <div className={styles.fieldError}>{saveError}</div> : null}

          <div className={styles.actionsRow}>
            {!isNew ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => setDeleteOpen(true)}
                disabled={saving}
              >
                מחק
              </button>
            ) : null}
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleSubmit}
              disabled={saving || !form.name || !form.slug || !form.categoryId}
            >
              {saving ? "שומר…" : "שמור"}
            </button>
          </div>

          {!isNew && detail.data ? (
            <VariantsSection
              productId={detail.data.product.id}
              variants={detail.data.variants}
              onChanged={() => detail.refresh()}
            />
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="מחיקת מוצר"
        description="האם אתה בטוח? אם למוצר יש היסטוריית הזמנות הוא יסומן כלא פעיל במקום להימחק."
        confirmLabel={deleting ? "מוחק…" : "מחק"}
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}

function VariantsSection({
  productId,
  variants,
  onChanged,
}: {
  productId: string;
  variants: AdminProductDetail["variants"];
  onChanged: () => void;
}) {
  const { accessToken } = useAdminAuth();
  const [creating, setCreating] = useState(false);
  const [stockTarget, setStockTarget] = useState<string | null>(null);

  async function handleCreateVariant(values: VariantValues) {
    await adminApi.post(accessToken, `/api/admin/variants`, {
      productId,
      ...values,
    });
    onChanged();
    setCreating(false);
  }

  return (
    <div className={styles.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
          וריאנטים
        </h3>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setCreating(true)}
        >
          וריאנט חדש
        </button>
      </div>

      <DataTable
        rows={variants}
        rowKey={(v) => v.id}
        emptyLabel="אין וריאנטים. הוסף לפחות אחד לפני פרסום."
        columns={[
          { key: "name", header: "שם", render: (v) => v.variant_name },
          { key: "sku", header: "מק״ט", render: (v) => <code>{v.sku}</code> },
          { key: "price", header: "מחיר", render: (v) => formatCurrency(v.price) },
          {
            key: "stock",
            header: "מלאי",
            render: (v) => (
              <Badge
                variant={
                  v.stock_quantity <= 0
                    ? "danger"
                    : v.stock_quantity <= v.low_stock_threshold
                      ? "warn"
                      : "success"
                }
              >
                {v.stock_quantity}
              </Badge>
            ),
          },
          {
            key: "active",
            header: "סטטוס",
            render: (v) => (
              <Badge variant={v.is_active ? "success" : "muted"}>
                {v.is_active ? "פעיל" : "לא פעיל"}
              </Badge>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (v) => (
              <button
                type="button"
                className={styles.btn}
                onClick={() => setStockTarget(v.id)}
              >
                עדכן מלאי
              </button>
            ),
          },
        ]}
      />

      {creating ? (
        <VariantEditor
          onCancel={() => setCreating(false)}
          onSave={handleCreateVariant}
        />
      ) : null}

      <StockAdjustDialog
        variantId={stockTarget}
        onClose={() => setStockTarget(null)}
        onDone={() => {
          setStockTarget(null);
          onChanged();
        }}
      />
    </div>
  );
}

type VariantValues = {
  variantName: string;
  sku: string;
  price: number;
  stockQuantity: number;
  size?: string;
  color?: string;
  material?: string;
  lowStockThreshold: number;
  isActive: boolean;
};

function VariantEditor({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (values: VariantValues) => Promise<void>;
}) {
  const [values, setValues] = useState<VariantValues>({
    variantName: "",
    sku: "",
    price: 0,
    stockQuantity: 0,
    size: "",
    color: "",
    material: "",
    lowStockThreshold: 5,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...values,
        size: values.size?.trim() || undefined,
        color: values.color?.trim() || undefined,
        material: values.material?.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "שגיאה ביצירת וריאנט.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--color-border)" }}>
      <h4 className={styles.sectionTitle} style={{ fontSize: "var(--font-size-base)" }}>
        וריאנט חדש
      </h4>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label>שם הוריאנט</label>
          <input
            value={values.variantName}
            onChange={(e) => setValues({ ...values, variantName: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label>מק״ט</label>
          <input
            value={values.sku}
            dir="ltr"
            onChange={(e) => setValues({ ...values, sku: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label>מחיר</label>
          <input
            type="number"
            step="0.01"
            value={values.price}
            onChange={(e) =>
              setValues({ ...values, price: Number(e.target.value) })
            }
          />
        </div>
        <div className={styles.field}>
          <label>מלאי התחלתי</label>
          <input
            type="number"
            step="1"
            value={values.stockQuantity}
            onChange={(e) =>
              setValues({ ...values, stockQuantity: Number(e.target.value) })
            }
          />
        </div>
        <div className={styles.field}>
          <label>מידה</label>
          <input
            value={values.size ?? ""}
            onChange={(e) => setValues({ ...values, size: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label>צבע</label>
          <input
            value={values.color ?? ""}
            onChange={(e) => setValues({ ...values, color: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label>חומר</label>
          <input
            value={values.material ?? ""}
            onChange={(e) => setValues({ ...values, material: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label>סף מלאי נמוך</label>
          <input
            type="number"
            step="1"
            value={values.lowStockThreshold}
            onChange={(e) =>
              setValues({
                ...values,
                lowStockThreshold: Number(e.target.value),
              })
            }
          />
        </div>
      </div>
      {error ? <div className={styles.fieldError}>{error}</div> : null}
      <div className={styles.actionsRow}>
        <button type="button" className={styles.btn} onClick={onCancel}>
          ביטול
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={saving || !values.variantName || !values.sku}
          onClick={submit}
        >
          {saving ? "שומר…" : "שמור"}
        </button>
      </div>
    </div>
  );
}

function StockAdjustDialog({
  variantId,
  onClose,
  onDone,
}: {
  variantId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { accessToken } = useAdminAuth();
  const [delta, setDelta] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (variantId) {
      setDelta(0);
      setReason("");
      setError(null);
    }
  }, [variantId]);

  async function submit() {
    if (!variantId) return;
    if (delta === 0) {
      setError("השינוי חייב להיות שונה מאפס.");
      throw new Error("zero delta");
    }
    setSaving(true);
    setError(null);
    try {
      await adminApi.post(
        accessToken,
        `/api/admin/variants/${variantId}/stock`,
        { delta, reason: reason.trim() || "manual" },
      );
      onDone();
    } catch (e) {
      const msg =
        e instanceof AdminApiError ? e.message : "שגיאה בעדכון מלאי.";
      setError(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }

  if (!variantId) return null;

  return (
    <ConfirmDialog
      open={Boolean(variantId)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="עדכון מלאי"
      description={
        <div>
          <div style={{ marginBottom: 12 }}>
            הזן שינוי במלאי (חיובי = הגדלה, שלילי = הקטנה). הפעולה נרשמת ביומן המלאי.
          </div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>שינוי (delta)</label>
              <input
                type="number"
                step="1"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
              />
            </div>
            <div className={styles.field}>
              <label>סיבה</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="restock / manual_correction / …"
              />
            </div>
          </div>
          {error ? <div className={styles.fieldError}>{error}</div> : null}
        </div>
      }
      confirmLabel={saving ? "מעדכן…" : "אשר"}
      onConfirm={submit}
    />
  );
}
