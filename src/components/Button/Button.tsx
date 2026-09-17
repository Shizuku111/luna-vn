import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

export type ButtonTheme = "default" | "primary" | "danger";
export type ButtonSize = "small" | "medium" | "large";

type ButtonProps = {
  theme?: ButtonTheme;
  size?: ButtonSize;
  icon?: boolean;
  round?: boolean;
  disabled?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  content?: ReactNode;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "prefix" | "children" | "content" | "disabled"
>;

export function Button({
  theme = "default",
  size = "medium",
  icon = false,
  round = false,
  disabled = false,
  prefix,
  suffix,
  content,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    "ui-btn",
    `ui-btn--theme-${theme}`,
    `ui-btn--size-${size}`,
    icon ? "ui-btn--icon" : "",
    round ? "ui-btn--round" : "",
    disabled ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} disabled={disabled} {...rest}>
      {prefix ? <span className="ui-btn-prefix">{prefix}</span> : null}
      {content != null ? <span className="ui-btn-content">{content}</span> : null}
      {suffix ? <span className="ui-btn-suffix">{suffix}</span> : null}
    </button>
  );
}
