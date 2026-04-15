import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BootstrapPayload, Category } from "@rimon/shared-types";

const CACHE_KEY = "rimon.bootstrap.v1";

interface BootstrapContextValue {
  logoImageUrl?: string;
  heroImageUrl?: string;
  categories: Category[];
  isBootstrapping: boolean;
  hasHydratedData: boolean;
}

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

function parseBootstrapCache(raw: string | null): BootstrapPayload | null {
  if (!raw?.trim()) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const payload = value as Partial<BootstrapPayload>;
    if (!Array.isArray(payload.categories)) return null;
    return {
      hero: payload.hero ?? {},
      logo: payload.logo ?? {},
      categories: payload.categories as Category[],
    };
  } catch {
    return null;
  }
}

function normalizePayload(payload: Partial<BootstrapPayload>): BootstrapPayload {
  const categories = Array.isArray(payload.categories)
    ? (payload.categories as Category[])
    : [];
  return {
    hero: {
      imageUrl: payload.hero?.imageUrl?.trim() || undefined,
    },
    logo: {
      imageUrl: payload.logo?.imageUrl?.trim() || undefined,
    },
    categories,
  };
}

function payloadToComparableString(payload: BootstrapPayload): string {
  return JSON.stringify(payload);
}

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const cachedPayload =
    typeof window === "undefined"
      ? null
      : parseBootstrapCache(localStorage.getItem(CACHE_KEY));

  const [bootstrap, setBootstrap] = useState<BootstrapPayload>(() => {
    if (cachedPayload) return cachedPayload;
    return { hero: {}, logo: {}, categories: [] };
  });
  const [isBootstrapping, setIsBootstrapping] = useState(!cachedPayload);
  const [hasHydratedData, setHasHydratedData] = useState(Boolean(cachedPayload));

  useEffect(() => {
    let cancelled = false;

    fetch("/api/site-settings/bootstrap")
      .then(async (res) => {
        if (!res.ok) return null;
        return normalizePayload((await res.json()) as Partial<BootstrapPayload>);
      })
      .then((nextPayload) => {
        if (cancelled || !nextPayload) return;
        setHasHydratedData(true);
        setBootstrap((prev) => {
          if (
            payloadToComparableString(prev) ===
            payloadToComparableString(nextPayload)
          ) {
            return prev;
          }
          return nextPayload;
        });
        localStorage.setItem(CACHE_KEY, JSON.stringify(nextPayload));
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      logoImageUrl: bootstrap.logo.imageUrl,
      heroImageUrl: bootstrap.hero.imageUrl,
      categories: bootstrap.categories,
      isBootstrapping,
      hasHydratedData,
    }),
    [bootstrap, hasHydratedData, isBootstrapping],
  );

  return (
    <BootstrapContext.Provider value={value}>
      {children}
    </BootstrapContext.Provider>
  );
}

export function useBootstrap(): BootstrapContextValue {
  const ctx = useContext(BootstrapContext);
  if (!ctx) {
    throw new Error("useBootstrap must be used within BootstrapProvider");
  }
  return ctx;
}
