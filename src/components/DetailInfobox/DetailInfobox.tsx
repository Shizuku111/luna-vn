import type { InfoboxDisplayRow } from "@/features/bangumi";
import type { MouseEvent } from "react";
import "./DetailInfobox.css";

type DetailInfoboxProps = {
  rows: InfoboxDisplayRow[];
  onOpenLink?: (href: string) => void;
  className?: string;
};

export function DetailInfobox({
  rows,
  onOpenLink,
  className,
}: DetailInfoboxProps) {
  if (rows.length === 0) return null;

  function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    onOpenLink?.(href);
  }

  return (
    <dl className={["detail-infobox", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div
          key={`${row.key}-${row.values.map((v) => v.text).join("|")}`}
          className="detail-infobox-row"
        >
          <dt>{row.key}</dt>
          <dd>
            {row.values.map((value, index) => {
              const valueClassName = [
                "detail-infobox-value",
                value.tag ? "is-tag" : "",
                value.href ? "is-link" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const itemKey = `${index}-${value.text}`;

              if (value.href) {
                return (
                  <a
                    key={itemKey}
                    className={valueClassName}
                    href={value.href}
                    title={value.title ?? value.href}
                    rel="noopener noreferrer"
                    onClick={(event) => handleLinkClick(event, value.href!)}
                  >
                    {value.text}
                  </a>
                );
              }

              return (
                <span
                  key={itemKey}
                  className={valueClassName}
                  title={value.title}
                >
                  {value.text}
                </span>
              );
            })}
          </dd>
        </div>
      ))}
    </dl>
  );
}
