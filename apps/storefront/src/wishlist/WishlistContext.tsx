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
import type { WishlistLine } from "@rimon/shared-types";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";

export interface WishlistContextValue {
  lines: WishlistLine[];
  loading: boolean;
  refreshWishlist: () => Promise<void>;
  isWishlisted: (variantId: string) => boolean;
  toggleWishlist: (
    variantId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeByLineId: (
    lineId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { accessToken, isReady } = useAuth();
  const [lines, setLines] = useState<WishlistLine[]>([]);
  const [loading, setLoading] = useState(false);
  const prevTokenRef = useRef<string | null | undefined>(undefined);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/wishlist", { accessToken: token });
      if (!res.ok) {
        setLines([]);
        return;
      }
      const data = (await res.json()) as unknown;
      setLines(Array.isArray(data) ? (data as WishlistLine[]) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!accessToken) {
      setLines([]);
      prevTokenRef.current = undefined;
      return;
    }
    if (prevTokenRef.current !== accessToken) {
      prevTokenRef.current = accessToken;
      void load(accessToken);
    }
  }, [isReady, accessToken, load]);

  const refreshWishlist = useCallback(async () => {
    if (!accessToken) {
      setLines([]);
      return;
    }
    await load(accessToken);
  }, [accessToken, load]);

  const variantToLineId = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lines) {
      m.set(l.variantId, l.id);
    }
    return m;
  }, [lines]);

  const isWishlisted = useCallback(
    (variantId: string) => variantToLineId.has(variantId),
    [variantToLineId],
  );

  const toggleWishlist = useCallback(
    async (
      variantId: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!accessToken) {
        return { ok: false, error: "נדרשת התחברות." };
      }
      const existingId = variantToLineId.get(variantId);
      if (existingId) {
        const res = await apiFetch(`/api/wishlist/${existingId}`, {
          method: "DELETE",
          accessToken,
        });
        if (!res.ok) {
          let msg = "לא ניתן להסיר מהרשימה.";
          try {
            const j = (await res.json()) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* ignore */
          }
          return { ok: false, error: msg };
        }
        await refreshWishlist();
        return { ok: true };
      }

      const res = await apiFetch("/api/wishlist", {
        method: "POST",
        body: { variantId },
        accessToken,
      });
      if (!res.ok && res.status !== 200) {
        let msg = "לא ניתן להוסיף לרשימה.";
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        return { ok: false, error: msg };
      }
      await refreshWishlist();
      return { ok: true };
    },
    [accessToken, variantToLineId, refreshWishlist],
  );

  const removeByLineId = useCallback(
    async (
      lineId: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!accessToken) {
        return { ok: false, error: "נדרשת התחברות." };
      }
      const res = await apiFetch(`/api/wishlist/${lineId}`, {
        method: "DELETE",
        accessToken,
      });
      if (!res.ok) {
        let msg = "לא ניתן להסיר.";
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        return { ok: false, error: msg };
      }
      await refreshWishlist();
      return { ok: true };
    },
    [accessToken, refreshWishlist],
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      lines,
      loading,
      refreshWishlist,
      isWishlisted,
      toggleWishlist,
      removeByLineId,
    }),
    [
      lines,
      loading,
      refreshWishlist,
      isWishlisted,
      toggleWishlist,
      removeByLineId,
    ],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlist must be used within WishlistProvider");
  }
  return ctx;
}
