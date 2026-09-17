import type { InputHTMLAttributes, ReactNode } from "react";
import "./Radio.css";

export type RadioProps = {
  checked?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  onChange?: (checked: boolean) => void;
  children?: ReactNode;
  className?: string;
  muted?: boolean;
  "aria-label"?: string;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked" | "disabled" | "name" | "value" | "onChange" | "children"
>;

export function Radio({
  checked = false,
  disabled = false,
  name,
  value,
  onChange,
  children,
  className = "",
  muted = false,
  "aria-label": ariaLabel,
  ...rest
}: RadioProps) {
  const classes = [
    "ui-radio",
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
        type="radio"
        className="ui-radio-input"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {children != null ? <span className="ui-radio-label">{children}</span> : null}
    </label>
  );
}
