export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl?: string;
  children?: Category[];
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  variantName: string;
  price: number;
  stockQuantity: number;
  sku: string;
  imageUrl?: string;
}

export type ProductWithVariants = Product & {
  variants: ProductVariant[];
  category?: Category;
  minPrice?: number;
};

/** Product row for category listing (first variant image + starting price). */
export interface CategoryProduct {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  price: number;
}

export interface CategoryProductsResponse {
  category: Pick<Category, "id" | "name" | "slug">;
  products: CategoryProduct[];
}
