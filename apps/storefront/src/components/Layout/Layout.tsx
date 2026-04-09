import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import styles from "./Layout.module.css";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { customer, clearSession } = useAuth();

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

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <p>&copy; {new Date().getFullYear()} רימון יודאיקה. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
}
