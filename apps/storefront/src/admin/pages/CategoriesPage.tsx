import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { LoadingState, ErrorState } from "../components/ErrorState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { adminApi, AdminApiError } from "../api/client";
import styles from "./common.module.css";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  sort_order: number;
};

type SubCategoryRow = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  sort_order: number;
};

type CategoryEditingState =
  | { mode: "create" }
  | { mode: "edit"; row: CategoryRow }
  | null;

type SubCategoryEditingState =
  | { mode: "create"; parentId: string }
  | { mode: "edit"; row: SubCategoryRow }
  | null;

export function CategoriesPage() {
  const { accessToken } = useAdminAuth();
  const {
    data: categories,
    loading: catsLoading,
    error: catsError,
    refresh: refreshCategories,
  } = useAdminFetch<CategoryRow[]>(`/api/admin/categories`);
  const {
    data: subCategories,
    loading: subsLoading,
    error: subsError,
    refresh: refreshSubs,
  } = useAdminFetch<SubCategoryRow[]>(`/api/admin/sub-categories`);

  const topCategories = useMemo(() => {
    const list = (categories ?? []).filter((c) => !c.parent_id);
    return [...list].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
  }, [categories]);

  const subsByParent = useMemo(() => {
    const map = new Map<string, SubCategoryRow[]>();
    for (const s of subCategories ?? []) {
      if (!map.has(s.category_id)) map.set(s.category_id, []);
      map.get(s.category_id)!.push(s);
    }
    map.forEach((list) =>
      list.sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
      ),
    );
    return map;
  }, [subCategories]);

  const [editingCategory, setEditingCategory] =
    useState<CategoryEditingState>(null);
  const [editingSub, setEditingSub] = useState<SubCategoryEditingState>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openParent = useCallback((id: string) => {
    setOpenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const [deleteCatTarget, setDeleteCatTarget] = useState<CategoryRow | null>(
    null,
  );
  const [deletingCat, setDeletingCat] = useState(false);
  const [deleteCatError, setDeleteCatError] = useState<string | null>(null);

  const [deleteSubTarget, setDeleteSubTarget] =
    useState<SubCategoryRow | null>(null);
  const [deletingSub, setDeletingSub] = useState(false);
  const [deleteSubError, setDeleteSubError] = useState<string | null>(null);

  async function handleSaveCategory(
    values: CategoryValues,
    existing?: CategoryRow,
  ) {
    const payload = {
      name: values.name.trim(),
      slug: values.slug.trim(),
      parentId: null,
      imageUrl: values.imageUrl?.trim() || undefined,
      seoTitle: values.seoTitle?.trim() || undefined,
      seoDescription: values.seoDescription?.trim() || undefined,
      sortOrder: values.sortOrder,
    };
    if (existing) {
      await adminApi.patch(
        accessToken,
        `/api/admin/categories/${existing.id}`,
        payload,
      );
    } else {
      await adminApi.post(accessToken, `/api/admin/categories`, payload);
    }
    refreshCategories();
    setEditingCategory(null);
  }

  async function handleSaveSub(
    values: SubCategoryValues,
    existing?: SubCategoryRow,
  ) {
    const payload = {
      categoryId: values.categoryId,
      name: values.name.trim(),
      slug: values.slug.trim(),
      imageUrl: values.imageUrl?.trim() || undefined,
      seoTitle: values.seoTitle?.trim() || undefined,
      seoDescription: values.seoDescription?.trim() || undefined,
      sortOrder: values.sortOrder,
    };
    if (existing) {
      await adminApi.patch(
        accessToken,
        `/api/admin/sub-categories/${existing.id}`,
        payload,
      );
    } else {
      await adminApi.post(accessToken, `/api/admin/sub-categories`, payload);
    }
    refreshSubs();
    setEditingSub(null);
  }

  async function handleDeleteCategory() {
    if (!deleteCatTarget) return;
    setDeletingCat(true);
    setDeleteCatError(null);
    try {
      await adminApi.del(
        accessToken,
        `/api/admin/categories/${deleteCatTarget.id}`,
      );
      refreshCategories();
      setDeleteCatTarget(null);
    } catch (e) {
      setDeleteCatError(
        e instanceof AdminApiError ? e.message : "שגיאה במחיקה.",
      );
      throw e;
    } finally {
      setDeletingCat(false);
    }
  }

  async function handleDeleteSub() {
    if (!deleteSubTarget) return;
    setDeletingSub(true);
    setDeleteSubError(null);
    try {
      await adminApi.del(
        accessToken,
        `/api/admin/sub-categories/${deleteSubTarget.id}`,
      );
      refreshSubs();
      setDeleteSubTarget(null);
    } catch (e) {
      setDeleteSubError(
        e instanceof AdminApiError ? e.message : "שגיאה במחיקה.",
      );
      throw e;
    } finally {
      setDeletingSub(false);
    }
  }

  const loading = catsLoading || subsLoading;
  const error = catsError ?? subsError;

  return (
    <>
      <PageHeader
        title="ניהול קטגוריות"
        description="קטגוריות ראשיות ותתי-קטגוריות לניהול מוצרי החנות."
        actions={
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setEditingCategory({ mode: "create" })}
          >
            קטגוריה חדשה
          </button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className={styles.card}>
          {topCategories.length === 0 ? (
            <span style={{ color: "var(--color-text-secondary)" }}>
              אין קטגוריות. התחל ביצירת קטגוריה חדשה.
            </span>
          ) : (
            topCategories.map((cat) => (
              <CategoryAccordionItem
                key={cat.id}
                category={cat}
                subCategories={subsByParent.get(cat.id) ?? []}
                isOpen={openIds.has(cat.id)}
                onToggle={() => toggleOpen(cat.id)}
                onEditCategory={(row) =>
                  setEditingCategory({ mode: "edit", row })
                }
                onDeleteCategory={(row) => setDeleteCatTarget(row)}
                onAddSub={(parentId) => {
                  openParent(parentId);
                  setEditingSub({ mode: "create", parentId });
                }}
                onEditSub={(row) => setEditingSub({ mode: "edit", row })}
                onDeleteSub={(row) => setDeleteSubTarget(row)}
              />
            ))
          )}
        </div>
      )}

      {editingCategory ? (
        <CategoryEditorDialog
          editing={editingCategory}
          onCancel={() => setEditingCategory(null)}
          onSave={handleSaveCategory}
        />
      ) : null}

      {editingSub ? (
        <SubCategoryEditorDialog
          allCategories={topCategories}
          editing={editingSub}
          onCancel={() => setEditingSub(null)}
          onSave={handleSaveSub}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteCatTarget)}
        onOpenChange={(next) => {
          if (!next) {
            setDeleteCatTarget(null);
            setDeleteCatError(null);
          }
        }}
        title="מחיקת קטגוריה"
        description={
          <>
            האם למחוק את “{deleteCatTarget?.name}”?
            <br />
            לא ניתן למחוק קטגוריה המכילה מוצרים או תתי-קטגוריות.
            {deleteCatError ? (
              <div className={styles.fieldError} style={{ marginTop: 8 }}>
                {deleteCatError}
              </div>
            ) : null}
          </>
        }
        destructive
        confirmLabel={deletingCat ? "מוחק…" : "מחק"}
        onConfirm={handleDeleteCategory}
      />

      <ConfirmDialog
        open={Boolean(deleteSubTarget)}
        onOpenChange={(next) => {
          if (!next) {
            setDeleteSubTarget(null);
            setDeleteSubError(null);
          }
        }}
        title="מחיקת תת-קטגוריה"
        description={
          <>
            האם למחוק את “{deleteSubTarget?.name}”?
            <br />
            לא ניתן למחוק תת-קטגוריה המכילה מוצרים.
            {deleteSubError ? (
              <div className={styles.fieldError} style={{ marginTop: 8 }}>
                {deleteSubError}
              </div>
            ) : null}
          </>
        }
        destructive
        confirmLabel={deletingSub ? "מוחק…" : "מחק"}
        onConfirm={handleDeleteSub}
      />
    </>
  );
}

function CategoryAccordionItem({
  category,
  subCategories,
  isOpen,
  onToggle,
  onEditCategory,
  onDeleteCategory,
  onAddSub,
  onEditSub,
  onDeleteSub,
}: {
  category: CategoryRow;
  subCategories: SubCategoryRow[];
  isOpen: boolean;
  onToggle: () => void;
  onEditCategory: (row: CategoryRow) => void;
  onDeleteCategory: (row: CategoryRow) => void;
  onAddSub: (parentId: string) => void;
  onEditSub: (row: SubCategoryRow) => void;
  onDeleteSub: (row: SubCategoryRow) => void;
}) {
  const hasSubs = subCategories.length > 0;
  const panelId = `category-panel-${category.id}`;
  const open = hasSubs && isOpen;

  function handleHeaderClick(e: ReactMouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    if (hasSubs) onToggle();
  }

  function handleHeaderKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (!hasSubs) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  }

  return (
    <div className={styles.accordionItem}>
      <div
        className={styles.accordionHeader}
        data-open={open ? "true" : "false"}
        role={hasSubs ? "button" : undefined}
        tabIndex={hasSubs ? 0 : -1}
        aria-expanded={hasSubs ? open : undefined}
        aria-controls={hasSubs ? panelId : undefined}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
      >
        <div className={styles.accordionLeft}>
          <span
            className={`${styles.accordionChevron} ${
              !hasSubs ? styles.accordionChevronDisabled : ""
            }`}
            data-open={open ? "true" : "false"}
            aria-hidden="true"
          >
            <ChevronDown size={18} strokeWidth={2} />
          </span>
          <strong>{category.name}</strong>
          <code style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            /{category.slug}
          </code>
          <span className={styles.tag}>מיון {category.sort_order}</span>
          <span className={styles.tag}>
            {subCategories.length} תתי-קטגוריות
          </span>
        </div>
        <div className={styles.accordionActions}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => onAddSub(category.id)}
          >
            + תת-קטגוריה
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => onEditCategory(category)}
          >
            ערוך
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => onDeleteCategory(category)}
          >
            מחק
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            role="region"
            key="body"
            className={styles.accordionBody}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.accordionInner}>
              {subCategories.length === 0 ? (
                <div className={styles.emptySubs}>
                  אין תתי-קטגוריות עדיין.
                </div>
              ) : (
                subCategories.map((sub) => (
                  <div className={styles.subRow} key={sub.id}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>{sub.name}</span>
                      <code
                        style={{
                          fontSize: 12,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        /{sub.slug}
                      </code>
                      <span className={styles.tag}>מיון {sub.sort_order}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => onEditSub(sub)}
                      >
                        ערוך
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={() => onDeleteSub(sub)}
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type CategoryValues = {
  name: string;
  slug: string;
  imageUrl: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number;
};

function CategoryEditorDialog({
  editing,
  onCancel,
  onSave,
}: {
  editing: Exclude<CategoryEditingState, null>;
  onCancel: () => void;
  onSave: (values: CategoryValues, existing?: CategoryRow) => Promise<void>;
}) {
  const [values, setValues] = useState<CategoryValues>(() => {
    if (editing.mode === "edit") {
      return {
        name: editing.row.name,
        slug: editing.row.slug,
        imageUrl: editing.row.image_url ?? "",
        seoTitle: editing.row.seo_title ?? "",
        seoDescription: editing.row.seo_description ?? "",
        sortOrder: editing.row.sort_order,
      };
    }
    return {
      name: "",
      slug: "",
      imageUrl: "",
      seoTitle: "",
      seoDescription: "",
      sortOrder: 0,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, []);

  async function handleConfirm() {
    if (!values.name.trim() || !values.slug.trim()) {
      setError("שם ומזהה כתובת נדרשים.");
      throw new Error("invalid");
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(values, editing.mode === "edit" ? editing.row : undefined);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "שגיאה בשמירה.");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={editing.mode === "edit" ? "עריכת קטגוריה" : "קטגוריה חדשה"}
      description={
        <div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>שם</label>
              <input
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label>מזהה כתובת (URL Slug)</label>
              <input
                value={values.slug}
                dir="ltr"
                onChange={(e) => setValues({ ...values, slug: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label>מיון</label>
              <input
                type="number"
                value={values.sortOrder}
                onChange={(e) =>
                  setValues({
                    ...values,
                    sortOrder: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label>כתובת תמונה</label>
              <input
                dir="ltr"
                value={values.imageUrl}
                onChange={(e) =>
                  setValues({ ...values, imageUrl: e.target.value })
                }
              />
            </div>
            <div className={styles.field}>
              <label>כותרת לקידום (SEO)</label>
              <input
                value={values.seoTitle}
                onChange={(e) =>
                  setValues({ ...values, seoTitle: e.target.value })
                }
              />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label>תיאור לקידום (SEO)</label>
              <textarea
                value={values.seoDescription}
                onChange={(e) =>
                  setValues({ ...values, seoDescription: e.target.value })
                }
              />
            </div>
          </div>
          {error ? <div className={styles.fieldError}>{error}</div> : null}
        </div>
      }
      confirmLabel={saving ? "שומר…" : "שמור"}
      onConfirm={handleConfirm}
    />
  );
}

type SubCategoryValues = {
  categoryId: string;
  name: string;
  slug: string;
  imageUrl: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number;
};

function SubCategoryEditorDialog({
  allCategories,
  editing,
  onCancel,
  onSave,
}: {
  allCategories: CategoryRow[];
  editing: Exclude<SubCategoryEditingState, null>;
  onCancel: () => void;
  onSave: (
    values: SubCategoryValues,
    existing?: SubCategoryRow,
  ) => Promise<void>;
}) {
  const [values, setValues] = useState<SubCategoryValues>(() => {
    if (editing.mode === "edit") {
      return {
        categoryId: editing.row.category_id,
        name: editing.row.name,
        slug: editing.row.slug,
        imageUrl: editing.row.image_url ?? "",
        seoTitle: editing.row.seo_title ?? "",
        seoDescription: editing.row.seo_description ?? "",
        sortOrder: editing.row.sort_order,
      };
    }
    return {
      categoryId: editing.parentId,
      name: "",
      slug: "",
      imageUrl: "",
      seoTitle: "",
      seoDescription: "",
      sortOrder: 0,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (
      !values.name.trim() ||
      !values.slug.trim() ||
      !values.categoryId
    ) {
      setError("שם, מזהה כתובת וקטגוריית אב נדרשים.");
      throw new Error("invalid");
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(values, editing.mode === "edit" ? editing.row : undefined);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "שגיאה בשמירה.");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title={
        editing.mode === "edit" ? "עריכת תת-קטגוריה" : "תת-קטגוריה חדשה"
      }
      description={
        <div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>קטגוריית אב (חובה עבור תת-קטגוריה)</label>
              <select
                value={values.categoryId}
                onChange={(e) =>
                  setValues({ ...values, categoryId: e.target.value })
                }
              >
                {allCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>שם</label>
              <input
                value={values.name}
                onChange={(e) =>
                  setValues({ ...values, name: e.target.value })
                }
              />
            </div>
            <div className={styles.field}>
              <label>מזהה כתובת (URL Slug)</label>
              <input
                value={values.slug}
                dir="ltr"
                onChange={(e) =>
                  setValues({ ...values, slug: e.target.value })
                }
              />
            </div>
            <div className={styles.field}>
              <label>מיון</label>
              <input
                type="number"
                value={values.sortOrder}
                onChange={(e) =>
                  setValues({
                    ...values,
                    sortOrder: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label>כתובת תמונה</label>
              <input
                dir="ltr"
                value={values.imageUrl}
                onChange={(e) =>
                  setValues({ ...values, imageUrl: e.target.value })
                }
              />
            </div>
            <div className={styles.field}>
              <label>כותרת לקידום (SEO)</label>
              <input
                value={values.seoTitle}
                onChange={(e) =>
                  setValues({ ...values, seoTitle: e.target.value })
                }
              />
            </div>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label>תיאור לקידום (SEO)</label>
              <textarea
                value={values.seoDescription}
                onChange={(e) =>
                  setValues({
                    ...values,
                    seoDescription: e.target.value,
                  })
                }
              />
            </div>
          </div>
          {error ? <div className={styles.fieldError}>{error}</div> : null}
        </div>
      }
      confirmLabel={saving ? "שומר…" : "שמור"}
      onConfirm={handleConfirm}
    />
  );
}
