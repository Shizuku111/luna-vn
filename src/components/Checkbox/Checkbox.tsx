import type { InputHTMLAttributes, ReactNode } from "react";
import "./Checkbox.css";

export type CheckboxProps = {
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  children?: ReactNode;
  className?: string;
  muted?: boolean;
  "aria-label"?: string;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked" | "disabled" | "onChange" | "children"
>;

export function Checkbox({
  checked = false,
  disabled = false,
  onChange,
  children,
  className = "",
  muted = false,
  "aria-label": ariaLabel,
  ...rest
}: CheckboxProps) {
  const classes = [
    "ui-checkbox",
    muted ? "is-muted" : "",
    disabled ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={classes}>
      <input
        {...rest}
        type="checkbox"
        className="ui-checkbox-input"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {children != null ? (
        <span className="ui-checkbox-label">{children}</span>
      ) : null}
    </label>
  );
}
