import { useState, type FormEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import styles from "./Dialog.module.css";

export function SudoPasswordDialog({
  open,
  onOpenChange,
  title = "אישור פעולה רגישה",
  description = "לצורך אבטחה, אנא הזן את סיסמתך כדי לאשר את הפעולה.",
  confirmLabel = "אשר",
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (password: string) => void | Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPassword("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password) {
      setError("יש להזין סיסמה.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה באישור הפעולה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} dir="rtl">
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <Dialog.Description className={styles.description}>
            {description}
          </Dialog.Description>
          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="sudo-password">סיסמה</label>
              <input
                id="sudo-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                dir="ltr"
              />
            </div>
            {error ? <div className={styles.errorText}>{error}</div> : null}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => handleOpenChange(false)}
                disabled={busy}
              >
                ביטול
              </button>
              <button
                type="submit"
                className={`${styles.btn} ${destructive ? styles.btnDanger : styles.btnPrimary}`}
                disabled={busy || !password}
              >
                {busy ? "…" : confirmLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
