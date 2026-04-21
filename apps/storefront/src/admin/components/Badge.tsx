import type { ReactNode } from "react";
import styles from "./Badge.module.css";

type Variant = "success" | "warn" | "danger" | "info" | "muted";

const VARIANT_STYLES: Record<Variant, string> = {
  success: styles.variantSuccess,
  warn: styles.variantWarn,
  danger: styles.variantDanger,
  info: styles.variantInfo,
  muted: styles.variantMuted,
};

export function Badge({
  children,
  variant = "muted",
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <span className={`${styles.badge} ${VARIANT_STYLES[variant]}`}>
      {children}
    </span>
  );
}
