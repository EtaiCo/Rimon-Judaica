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
