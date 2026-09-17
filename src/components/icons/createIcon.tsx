import type { ComponentType, CSSProperties, SVGProps } from "react";
import "./icons.css";

export type IconSize = number | string;

export type IconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: IconSize;
};

function resolveFontSize(size: IconSize | undefined): string | undefined {
  if (size == null) return undefined;
  return typeof size === "number" ? `${size}px` : size;
}

export function createIcon(
  Svg: ComponentType<SVGProps<SVGSVGElement>>,
  displayName?: string,
) {
  function Icon({ size, className = "", style, ...rest }: IconProps) {
    const fontSize = resolveFontSize(size);
    const mergedStyle: CSSProperties = {
      ...style,
      ...(fontSize ? { fontSize } : null),
    };

    return (
      <Svg
        className={["ui-icon", className].filter(Boolean).join(" ")}
        style={mergedStyle}
        focusable="false"
        {...rest}
      />
    );
  }

  Icon.displayName =
    displayName ?? `Icon(${Svg.displayName || Svg.name || "Svg"})`;

  return Icon;
}
