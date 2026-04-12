import type { ProductVariant } from "@rimon/shared-types";

/** Prefer cheapest in-stock variant for card imagery and primary CTA. */
export function pickDisplayVariant(
  variants: ProductVariant[],
): ProductVariant | null {
  if (variants.length === 0) return null;
  const sorted = [...variants].sort((a, b) => a.price - b.price);
  const inStock = sorted.find((v) => v.stockQuantity > 0);
  return inStock ?? sorted[0] ?? null;
}
