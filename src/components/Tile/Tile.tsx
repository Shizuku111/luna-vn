import { type ReactNode, type Ref } from "react";
import "./Tile.css";

export type TileImageShape = "circle" | "cover";
export type TileImageSide = "left" | "right";

export type TileProps = {
  title: string;
  lines?: Array<string | null | undefined>;
  imageUrl?: string | null;
  imageShape?: TileImageShape;
  imageSide?: TileImageSide;
  plain?: boolean;
  mediaRef?: Ref<HTMLDivElement | null>;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
};

function resolveLines(lines?: Array<string | null | undefined>) {
  return (lines ?? []).map((line) => line?.trim() ?? "").filter(Boolean);
}

export function Tile({
  title,
  lines,
  imageUrl,
  imageShape = "circle",
  imageSide = "left",
  plain = false,
  mediaRef,
  onClick,
  className = "",
  children,
}: TileProps) {
  const secondary = resolveLines(lines);
  const classes = [
    "ui-tile",
    `ui-tile--image-${imageShape}`,
    `ui-tile--side-${imageSide}`,
    plain ? "ui-tile--plain" : "",
    onClick ? "is-clickable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} onClick={onClick}>
      <div ref={mediaRef} className="ui-tile-media">
        {imageUrl ? (
          <img src={imageUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="ui-tile-media-empty" aria-hidden />
        )}
      </div>
      <div className="ui-tile-meta">
        <p className="ui-tile-title" title={title}>
          <bdi>{title}</bdi>
        </p>
        {secondary.map((line, index) => (
          <p key={`${index}-${line}`} className="ui-tile-line" title={line}>
            <bdi>{line}</bdi>
          </p>
        ))}
        {children}
      </div>
    </div>
  );
}
