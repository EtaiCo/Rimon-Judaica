import { Link, useParams } from "react-router-dom";
import { Layout } from "../components/Layout/Layout";
import styles from "./CategoryPage.module.css";

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <Layout>
      <div className={styles.wrap}>
        <p className={styles.label}>קטגוריה</p>
        <h1 className={styles.slug}>{slug ?? "—"}</h1>
        <p className={styles.hint}>דף קטגוריה — בקרוב.</p>
        <Link to="/" className={styles.back}>
          חזרה לדף הבית
        </Link>
      </div>
    </Layout>
  );
}
