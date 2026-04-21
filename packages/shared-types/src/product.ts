export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  sortOrder?: number;
  children?: Category[];
  subCategories?: SubCategory[];
};

export type SubCategory = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  createdAt?: string;
};

export type Product = {
  id: string;
  categoryId: string;
  subCategoryId?: string | null;
  name: string;
  slug: string;
  description: string;
  images: string[];
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
};

export type ProductVariant = {
  id: string;
  productId: string;
  variantName: string;
  price: number;
  stockQuantity: number;
  sku: string;
  imageUrl?: string;
  size?: string;
  color?: string;
  material?: string;
  lowStockThreshold?: number;
  isActive?: boolean;
};

export type ProductWithVariants = Product & {
  variants: ProductVariant[];
  category?: Category;
  minPrice?: number;
};

/** Product row for category listing (variants for cards + listing price). */
export type CategoryProduct = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  /** Minimum variant price (for quick display). */
  price: number;
  minPrice?: number;
  variants: ProductVariant[];
};

export type CategoryProductsResponse = {
  category: Pick<Category, "id" | "name" | "slug">;
  subCategory?: Pick<SubCategory, "id" | "name" | "slug">;
  products: CategoryProduct[];
};

export type ProductSearchResponse = {
  products: ProductWithVariants[];
  suggestions: string[];
};
