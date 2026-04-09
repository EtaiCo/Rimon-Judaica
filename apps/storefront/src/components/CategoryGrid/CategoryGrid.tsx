import type { Category } from "@rimon/shared-types";
import { CategoryCard } from "../CategoryCard/CategoryCard";
import styles from "./CategoryGrid.module.css";

interface CategoryGridProps {
  categories: Category[];
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <div className={styles.grid}>
      {categories.map((cat) => (
        <CategoryCard key={cat.id} category={cat} />
      ))}
    </div>
  );
}
