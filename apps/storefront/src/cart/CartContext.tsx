import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { CartLine } from "@rimon/shared-types";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import {
  type GuestLineMeta,
  readGuestCart,
  writeGuestCart,
  addOrMergeGuestLine,
  decrementGuestLineById,
  metaFromGuestLine,
  removeGuestLineById,
  type GuestCartLine,
} from "./guestCartStorage";

const OUT_OF_STOCK_API = "מצטערים, המלאי אזל";
const SYNC_OOS_TOAST = "מצטערים, אחד הפריטים שהוספת כבר אינו זמין";

export interface CartContextValue {
  isGuest: boolean;
  guestItems: GuestCartLine[];
  serverItems: CartLine[];
  itemCount: number;
  loading: boolean;
  lineActionId: string | null;
  refreshCart: () => Promise<void>;
  addToCart: (
    variantId: string,
    quantity?: number,
    meta?: GuestLineMeta,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  incrementLine: (
    lineId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  decrementLine: (
    lineId: string,
    amount?: number,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeLine: (
    lineId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { accessToken, isReady } = useAuth();
  const [guestItems, setGuestItems] = useState<GuestCartLine[]>([]);
  const [serverItems, setServerItems] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [lineActionId, setLineActionId] = useState<string | null>(null);
  const prevTokenRef = useRef<string | null | undefined>(undefined);

  const guestItemsRef = useRef(guestItems);
  const serverItemsRef = useRef(serverItems);
  guestItemsRef.current = guestItems;
  serverItemsRef.current = serverItems;

  const isGuest = !accessToken;

  const loadServerCart = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/cart", { accessToken: token });
      if (!res.ok) {
        setServerItems([]);
        return;
      }
      const data = (await res.json()) as unknown;
      setServerItems(Array.isArray(data) ? (data as CartLine[]) : []);
    } catch {
      setServerItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCart = useCallback(async () => {
    if (accessToken) {
      await loadServerCart(accessToken);
    } else {
      setGuestItems(readGuestCart());
    }
  }, [accessToken, loadServerCart]);

  useEffect(() => {
    if (!isReady) return;
    const token = accessToken ?? null;
    const prev = prevTokenRef.current;

    if (prev === undefined) {
      prevTokenRef.current = token;
      if (token) {
        void loadServerCart(token);
      } else {
        setGuestItems(readGuestCart());
      }
      return;
    }

    if (prev === null && token !== null) {
      const snapshot = readGuestCart();
      prevTokenRef.current = token;
      setGuestItems([]);
      if (snapshot.length === 0) {
        void loadServerCart(token);
        return;
      }
      void (async () => {
        const failed: GuestCartLine[] = [];
        let hadOutOfStock = false;

        for (const line of snapshot) {
          const res = await apiFetch("/api/cart/add", {
            method: "POST",
            body: { variantId: line.variantId, quantity: line.quantity },
            accessToken: token,
          });
          if (res.ok) continue;

          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          const msg = typeof data.error === "string" ? data.error : "";
          if (res.status === 409 || msg.includes(OUT_OF_STOCK_API)) {
            hadOutOfStock = true;
          }
          failed.push(line);
        }

        writeGuestCart(failed);
        if (hadOutOfStock) {
          toast.error(SYNC_OOS_TOAST);
        }
        await loadServerCart(token);
      })();
      return;
    }

    prevTokenRef.current = token;
    if (token) {
      void loadServerCart(token);
    } else {
      setServerItems([]);
      setGuestItems(readGuestCart());
    }
  }, [isReady, accessToken, loadServerCart]);

  const addToCart = useCallback(
    async (variantId: string, quantity = 1, meta?: GuestLineMeta) => {
      if (!accessToken) {
        if (!meta) {
          return {
            ok: false as const,
            error: "חסרים פרטי מוצר להוספה לעגלה.",
          };
        }
        const current = readGuestCart();
        const next = addOrMergeGuestLine(
          current,
          variantId,
          quantity,
          meta,
        );
        writeGuestCart(next);
        setGuestItems(next);
        return { ok: true as const };
      }

      const res = await apiFetch("/api/cart/add", {
        method: "POST",
        body: { variantId, quantity },
        accessToken,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        return {
          ok: false as const,
          error:
            typeof data.error === "string" ? data.error : "אירעה שגיאה.",
        };
      }
      await loadServerCart(accessToken);
      return { ok: true as const };
    },
    [accessToken, loadServerCart],
  );

  const incrementLine = useCallback(
    async (lineId: string) => {
      if (!accessToken) {
        const line = guestItemsRef.current.find((l) => l.id === lineId);
        if (!line) {
          return { ok: false as const, error: "הפריט לא נמצא." };
        }
        setLineActionId(lineId);
        try {
          const current = readGuestCart();
          const next = addOrMergeGuestLine(
            current,
            line.variantId,
            1,
            metaFromGuestLine(line),
          );
          writeGuestCart(next);
          setGuestItems(next);
          return { ok: true as const };
        } finally {
          setLineActionId(null);
        }
      }

      const line = serverItemsRef.current.find((l) => l.id === lineId);
      if (!line) {
        return { ok: false as const, error: "הפריט לא נמצא." };
      }
      setLineActionId(lineId);
      try {
        const res = await apiFetch("/api/cart/add", {
          method: "POST",
          body: { variantId: line.variantId, quantity: 1 },
          accessToken,
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          const msg =
            typeof data.error === "string" ? data.error : "אירעה שגיאה.";
          if (res.status === 409 || msg.includes(OUT_OF_STOCK_API)) {
            toast.error(OUT_OF_STOCK_API);
          }
          return { ok: false as const, error: msg };
        }
        await loadServerCart(accessToken);
        return { ok: true as const };
      } finally {
        setLineActionId(null);
      }
    },
    [accessToken, loadServerCart],
  );

  const decrementLine = useCallback(
    async (lineId: string, amount = 1) => {
      if (!accessToken) {
        setLineActionId(lineId);
        try {
          const current = readGuestCart();
          const next = decrementGuestLineById(current, lineId, amount);
          writeGuestCart(next);
          setGuestItems(next);
          return { ok: true as const };
        } finally {
          setLineActionId(null);
        }
      }

      setLineActionId(lineId);
      try {
        const res = await apiFetch(`/api/cart/line/${encodeURIComponent(lineId)}`, {
          method: "PATCH",
          body: { amount },
          accessToken,
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          return {
            ok: false as const,
            error:
              typeof data.error === "string" ? data.error : "אירעה שגיאה.",
          };
        }
        await loadServerCart(accessToken);
        return { ok: true as const };
      } finally {
        setLineActionId(null);
      }
    },
    [accessToken, loadServerCart],
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      if (!accessToken) {
        setLineActionId(lineId);
        try {
          const current = readGuestCart();
          const next = removeGuestLineById(current, lineId);
          writeGuestCart(next);
          setGuestItems(next);
          return { ok: true as const };
        } finally {
          setLineActionId(null);
        }
      }

      setLineActionId(lineId);
      try {
        const res = await apiFetch(
          `/api/cart/line/${encodeURIComponent(lineId)}`,
          {
            method: "DELETE",
            accessToken,
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          return {
            ok: false as const,
            error:
              typeof data.error === "string" ? data.error : "אירעה שגיאה.",
          };
        }
        await loadServerCart(accessToken);
        return { ok: true as const };
      } finally {
        setLineActionId(null);
      }
    },
    [accessToken, loadServerCart],
  );

  const itemCount = useMemo(() => {
    if (accessToken) {
      return serverItems.reduce((sum, line) => sum + line.quantity, 0);
    }
    return guestItems.reduce((sum, line) => sum + line.quantity, 0);
  }, [accessToken, serverItems, guestItems]);

  const value = useMemo(
    () => ({
      isGuest,
      guestItems,
      serverItems,
      itemCount,
      loading,
      lineActionId,
      refreshCart,
      addToCart,
      incrementLine,
      decrementLine,
      removeLine,
    }),
    [
      isGuest,
      guestItems,
      serverItems,
      itemCount,
      loading,
      lineActionId,
      refreshCart,
      addToCart,
      incrementLine,
      decrementLine,
      removeLine,
    ],
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}

export type { GuestLineMeta } from "./guestCartStorage";
