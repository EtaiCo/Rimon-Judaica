import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import styles from "./Dialog.module.css";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      /* caller surfaces its own error; keep dialog open */
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} dir="rtl">
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className={styles.description}>
              {description}
            </Dialog.Description>
          ) : null}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${destructive ? styles.btnDanger : styles.btnPrimary}`}
              onClick={handleConfirm}
              disabled={busy}
            >
              {busy ? "…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
