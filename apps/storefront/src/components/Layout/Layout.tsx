import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "../../cart/CartContext";
import { CartDrawer } from "../CartDrawer/CartDrawer";
import { Header } from "../Header/Header";
import { SearchOverlay } from "../SearchOverlay/SearchOverlay";
import styles from "./Layout.module.css";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const { addEventSeq, lastAddedVariantId } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedVariantId, setHighlightedVariantId] = useState<
    string | null
  >(null);
  const closeTimerRef = useRef<number | null>(null);
  const seenAddEventRef = useRef(addEventSeq);

  const clearAutoClose = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  /** Coordinates drawer UX for add-to-cart events (open, highlight, auto-close). */
  useEffect(() => {
    if (addEventSeq <= seenAddEventRef.current) return;
    seenAddEventRef.current = addEventSeq;
    setCartOpen(true);
    setHighlightedVariantId(lastAddedVariantId);

    if (lastAddedVariantId) {
      const id = window.setTimeout(
        () => setHighlightedVariantId((v) => (v === lastAddedVariantId ? null : v)),
        1300,
      );
      return () => window.clearTimeout(id);
    }
  }, [addEventSeq, lastAddedVariantId]);

  useEffect(() => {
    if (!cartOpen) {
      clearAutoClose();
      return;
    }
    clearAutoClose();
    closeTimerRef.current = window.setTimeout(() => {
      setCartOpen(false);
      closeTimerRef.current = null;
    }, 3600);
    return clearAutoClose;
  }, [cartOpen, clearAutoClose, addEventSeq]);

  useEffect(() => () => clearAutoClose(), [clearAutoClose]);

  const openDrawerManually = useCallback(() => {
    clearAutoClose();
    setCartOpen(true);
  }, [clearAutoClose]);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  const closeDrawer = useCallback(() => {
    clearAutoClose();
    setCartOpen(false);
    setHighlightedVariantId(null);
  }, [clearAutoClose]);

  return (
    <div className={styles.wrapper}>
      <Header onOpenCart={openDrawerManually} onOpenSearch={openSearch} />

      <CartDrawer
        open={cartOpen}
        onClose={closeDrawer}
        highlightedVariantId={highlightedVariantId}
        onInteract={clearAutoClose}
      />
      <SearchOverlay open={searchOpen} onClose={closeSearch} />

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <p>&copy; {new Date().getFullYear()} רימון יודאיקה. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
}
