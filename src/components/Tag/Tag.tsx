import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import "./Tag.css";

export type TagTheme = "default" | "primary" | "warning";
export type TagSize = "small" | "medium";

export type TagProps = {
  theme?: TagTheme;
  size?: TagSize;
  prefix?: ReactNode;
  content?: ReactNode;
  interactive?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "content" | "prefix">;

export function Tag({
  theme = "default",
  size = "medium",
  prefix,
  content,
  className = "",
  interactive,
  onClick,
  onKeyDown,
  ...rest
}: TagProps) {
  const clickable = Boolean(onClick) && interactive !== false;
  const classes = [
    "ui-tag",
    `ui-tag--theme-${theme}`,
    `ui-tag--size-${size}`,
    clickable ? "" : "ui-tag--static",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || !clickable) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.currentTarget.click();
    }
  }

  return (
    <div
      className={classes}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {prefix ? <span className="ui-tag-prefix">{prefix}</span> : null}
      {content != null ? <span className="ui-tag-content">{content}</span> : null}
    </div>
  );
}
