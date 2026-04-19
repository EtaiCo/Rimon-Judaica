import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Underline text field using design token typography and focus border.
 * Forwards the native `<input>` ref for focus management and autofill behavior.
 *
 * @param props - Standard input attributes (`type`, `placeholder`, etc.).
 * @returns An `<input>` element.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function InputForwarded({ className, ...rest }, ref) {
    const merged =
      className === undefined || className === ""
        ? styles.root
        : `${styles.root} ${className}`;
    return <input ref={ref} className={merged} {...rest} />;
  },
);
