import type { ReactNode } from "react";
import styles from "./ErrorState.module.css";

export function LoadingState({ label = "טוען…" }: { label?: string }) {
  return <div className={styles.loading}>{label}</div>;
}

export function ErrorState({
  title = "שגיאה",
  message,
  action,
}: {
  title?: string;
  message?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      <h3 className={styles.errorTitle}>{title}</h3>
      {message ? <p className={styles.errorMessage}>{message}</p> : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}
