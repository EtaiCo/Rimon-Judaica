import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./Button.module.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Visible label; use Hebrew or other locale text from the caller. */
  children?: ReactNode;
};

/**
 * Primary action button styled with design tokens (burgundy fill).
 * Forwards the native `<button>` ref for focus management and form integration.
 *
 * @param props - Standard button attributes.
 * @returns A `<button>` element.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function ButtonForwarded(
    { children, className, type = "button", ...rest },
    ref,
  ) {
    const merged =
      className === undefined || className === ""
        ? styles.primary
        : `${styles.primary} ${className}`;
    return (
      <button ref={ref} type={type} className={merged} {...rest}>
        {children}
      </button>
    );
  },
);
