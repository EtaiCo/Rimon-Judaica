import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import styles from "./Layout.module.css";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.container}>
          <Link to="/" className={styles.logo}>
            רימון יודאיקה
          </Link>
          <nav className={styles.nav}>
            <Link to="/">ראשי</Link>
            <a href="/products">מוצרים</a>
            <a href="/about">אודות</a>
            <a href="/contact">צור קשר</a>
          </nav>
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
