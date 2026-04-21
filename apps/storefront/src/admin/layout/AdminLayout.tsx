import { type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";
import styles from "./AdminLayout.module.css";

const NAV_ITEMS: Array<{ to: string; label: string }> = [
  { to: "/admin", label: "סקירה" },
  { to: "/admin/products", label: "מוצרים" },
  { to: "/admin/categories", label: "קטגוריות" },
  { to: "/admin/orders", label: "הזמנות" },
  { to: "/admin/customers", label: "משתמשים" },
  { to: "/admin/activity-log", label: "יומן פעילות" },
  { to: "/admin/security-events", label: "אירועי אבטחה" },
];

function pageTitleFromPath(pathname: string): string {
  if (pathname === "/admin" || pathname === "/admin/") return "סקירה כללית";
  if (pathname.startsWith("/admin/products")) return "ניהול מוצרים";
  if (pathname.startsWith("/admin/categories")) return "ניהול קטגוריות";
  if (pathname.startsWith("/admin/orders")) return "ניהול הזמנות";
  if (pathname.startsWith("/admin/customers")) return "ניהול משתמשים";
  if (pathname.startsWith("/admin/activity-log")) return "יומן פעולות";
  if (pathname.startsWith("/admin/security-events")) return "אירועי אבטחה";
  return "ניהול";
}

export function AdminLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const { customer, clearSession } = useAdminAuth();

  return (
    <div className={styles.shell} dir="rtl">
      <aside className={styles.sidebar}>
        <Link to="/admin" className={styles.brand}>
          רימון · ניהול
        </Link>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div>מחובר: {customer?.email ?? "—"}</div>
          <Link to="/" className={styles.footerLink}>
            ← חזרה לחנות
          </Link>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topBar}>
          <h1 className={styles.topBarTitle}>
            {pageTitleFromPath(location.pathname)}
          </h1>
          <div className={styles.topBarActions}>
            <Link to="/" className={styles.viewStoreLink} target="_blank" rel="noreferrer">
              צפה בחנות
            </Link>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={() => clearSession()}
            >
              התנתקות
            </button>
          </div>
        </div>
        <div className={styles.content}>{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
