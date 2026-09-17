import { useDetailOverlayAtmosphere } from "@/components/DetailOverlay";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import "./DetailAtmosphere.css";

type DetailAtmosphereProps = {
  imageUrl?: string | null;
  colorRgb?: string | null;
};

export function DetailAtmosphere({
  imageUrl = null,
  colorRgb = null,
}: DetailAtmosphereProps) {
  const slot = useDetailOverlayAtmosphere();
  if (!slot) return null;

  const layer = (
    <div
      className={[
        "detail-atmosphere",
        imageUrl ? "has-cover" : "",
        colorRgb ? "has-color" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        colorRgb
          ? ({
              "--detail-atmosphere": colorRgb,
            } as CSSProperties)
          : undefined
      }
      aria-hidden
    >
      {imageUrl ? (
        <div
          className="detail-atmosphere-blur"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      ) : null}
      <div className="detail-atmosphere-wash" />
    </div>
  );

  return createPortal(layer, slot);
}
