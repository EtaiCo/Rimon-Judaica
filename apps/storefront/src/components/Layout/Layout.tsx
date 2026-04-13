import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PanelRightOpen, ShoppingCart, User } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useCart } from "../../cart/CartContext";
import { CartDrawer } from "../CartDrawer/CartDrawer";
import styles from "./Layout.module.css";

interface LayoutProps {
  children: ReactNode;
}

const GUEST_CART_TOOLTIP =
  "התחבר כדי לשריין את הפריטים ל-3 ימים";

export function Layout({ children }: LayoutProps) {
  const { customer, clearSession, accessToken } = useAuth();
  const { itemCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.container}>
          <Link to="/" className={styles.logo}>
            רימון יודאיקה
          </Link>
          <div className={styles.navCluster}>
            <nav className={styles.nav}>
              <Link to="/">ראשי</Link>
              <a href="/products">מוצרים</a>
              <a href="/about">אודות</a>
              <a href="/contact">צור קשר</a>
            </nav>
            <div className={styles.cartCluster}>
              <Link
                to={customer ? "/account" : "/login"}
                className={styles.cartLink}
                aria-label={customer ? "האזור האישי" : "התחברות"}
                title={customer ? "האזור האישי" : "התחברות"}
              >
                <User size={22} strokeWidth={1.75} aria-hidden />
              </Link>
              <Link
                to="/cart"
                className={styles.cartLink}
                aria-label="עגלת קניות"
                title={
                  !accessToken && itemCount > 0
                    ? GUEST_CART_TOOLTIP
                    : undefined
                }
              >
                <ShoppingCart size={22} strokeWidth={1.75} aria-hidden />
                {itemCount > 0 ? (
                  <span className={styles.cartBadge}>{itemCount}</span>
                ) : null}
              </Link>
              <button
                type="button"
                className={styles.quickViewBtn}
                aria-label="מבט מהיר על העגלה"
                onClick={() => setCartOpen(true)}
              >
                <PanelRightOpen size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <nav className={styles.authNav} aria-label="חשבון">
              {customer ? (
                <>
                  <span className={styles.greeting}>
                    שלום, {customer.full_name?.trim() || customer.email}
                  </span>
                  <button
                    type="button"
                    className={styles.authButton}
                    onClick={() => clearSession()}
                  >
                    התנתקות
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className={styles.authLink}>
                    התחברות
                  </Link>
                  <Link to="/register" className={styles.authLink}>
                    הרשמה
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <p>&copy; {new Date().getFullYear()} רימון יודאיקה. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
}
