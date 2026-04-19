const STORAGE_KEY = "rimon_guest_cart";

/** Persisted guest cart row with display snapshot at add time. */
export type GuestCartLine = {
  id: string;
  variantId: string;
  quantity: number;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  price: number;
  imageUrl?: string;
};

/** Metadata required when adding to guest cart (from product + variant). */
export type GuestLineMeta = {
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  price: number;
  imageUrl?: string;
};

function isGuestCartLine(v: unknown): v is GuestCartLine {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.variantId === "string" &&
    typeof o.quantity === "number" &&
    Number.isFinite(o.quantity) &&
    o.quantity >= 1 &&
    Math.floor(o.quantity) === o.quantity &&
    typeof o.productId === "string" &&
    typeof o.productName === "string" &&
    typeof o.productSlug === "string" &&
    typeof o.variantName === "string" &&
    typeof o.price === "number" &&
    Number.isFinite(o.price) &&
    (o.imageUrl === undefined || typeof o.imageUrl === "string")
  );
}

export function readGuestCart(): GuestCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGuestCartLine);
  } catch {
    return [];
  }
}

export function writeGuestCart(lines: GuestCartLine[]): void {
  if (typeof window === "undefined") return;
  try {
    if (lines.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Merge by variantId (increment quantity). Returns the updated full cart.
 */
export function addOrMergeGuestLine(
  current: GuestCartLine[],
  variantId: string,
  quantity: number,
  meta: GuestLineMeta,
): GuestCartLine[] {
  const idx = current.findIndex((l) => l.variantId === variantId);
  if (idx >= 0) {
    const next = [...current];
    const row = next[idx]!;
    next[idx] = {
      ...row,
      quantity: row.quantity + quantity,
      productName: meta.productName,
      productSlug: meta.productSlug,
      variantName: meta.variantName,
      price: meta.price,
      imageUrl: meta.imageUrl ?? row.imageUrl,
    };
    return next;
  }
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return [
    ...current,
    {
      id,
      variantId,
      quantity,
      productId: meta.productId,
      productName: meta.productName,
      productSlug: meta.productSlug,
      variantName: meta.variantName,
      price: meta.price,
      imageUrl: meta.imageUrl,
    },
  ];
}

export function metaFromGuestLine(line: GuestCartLine): GuestLineMeta {
  return {
    productId: line.productId,
    productName: line.productName,
    productSlug: line.productSlug,
    variantName: line.variantName,
    price: line.price,
    imageUrl: line.imageUrl,
  };
}

export function removeGuestLineById(
  current: GuestCartLine[],
  lineId: string,
): GuestCartLine[] {
  return current.filter((l) => l.id !== lineId);
}

export function decrementGuestLineById(
  current: GuestCartLine[],
  lineId: string,
  amount = 1,
): GuestCartLine[] {
  const idx = current.findIndex((l) => l.id === lineId);
  if (idx < 0) return current;
  const row = current[idx]!;
  if (row.quantity <= amount) {
    return current.filter((l) => l.id !== lineId);
  }
  const next = [...current];
  next[idx] = { ...row, quantity: row.quantity - amount };
  return next;
}
