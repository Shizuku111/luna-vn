import bangumiIcon from "@/assets/bangumi-icon-s.png";
import { useDetailOverlayChrome } from "@/components/DetailOverlay";
import { Button } from "@/components/Button";
import { DropDown, type DropDownOption } from "@/components/DropDown";
import { CloseIcon, MoreVerticalIcon } from "@/components/icons";
import { Tooltip } from "@/components/Tooltip";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import "./DetailToolbar.css";

export type DetailToolbarMoreItem = {
  key: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type DetailToolbarProps = {
  onClose: () => void;
  onOpenBangumi?: () => void;
  moreItems?: DetailToolbarMoreItem[];
  deleting?: boolean;
  closeLabel?: string;
  bangumiLabel?: string;
  moreLabel?: string;
  className?: string;
};

export function DetailToolbar({
  onClose,
  onOpenBangumi,
  moreItems = [],
  deleting = false,
  closeLabel = "关闭详情",
  bangumiLabel = "在 Bangumi 打开",
  moreLabel = "更多",
  className,
}: DetailToolbarProps) {
  const chromeSlot = useDetailOverlayChrome();

  const moreOptions = useMemo<DropDownOption[]>(
    () =>
      moreItems.map((item) => ({
        value: item.key,
        label: item.label,
        danger: item.danger,
        disabled: item.disabled || deleting,
      })),
    [moreItems, deleting],
  );

  const moreHandlers = useMemo(() => {
    const map = new Map<string, () => void>();
    for (const item of moreItems) {
      map.set(item.key, item.onSelect);
    }
    return map;
  }, [moreItems]);

  const toolbar = (
    <div
      className={["detail-toolbar", className].filter(Boolean).join(" ")}
    >
      <Tooltip content={closeLabel} placement="left">
        <Button
          className="detail-toolbar-close"
          icon
          round
          size="large"
          aria-label={closeLabel}
          content={<CloseIcon aria-hidden />}
          onClick={onClose}
        />
      </Tooltip>

      {onOpenBangumi ? (
        <Tooltip content={bangumiLabel} placement="left" disabled={deleting}>
          <Button
            className="detail-toolbar-bangumi"
            icon
            round
            size="large"
            disabled={deleting}
            aria-label={bangumiLabel}
            content={
              <img
                className="detail-toolbar-bangumi-icon"
                src={bangumiIcon}
                alt=""
                aria-hidden
              />
            }
            onClick={onOpenBangumi}
          />
        </Tooltip>
      ) : null}

      {moreOptions.length > 0 ? (
        <DropDown
          className="detail-toolbar-more"
          placement="left-start"
          options={moreOptions}
          onSelect={(key) => {
            moreHandlers.get(key)?.();
          }}
          trigger={
            <Tooltip content={moreLabel} placement="left" disabled={deleting}>
              <Button
                className="detail-toolbar-more-btn"
                icon
                round
                size="large"
                disabled={deleting}
                aria-label={moreLabel}
                aria-haspopup="menu"
                content={<MoreVerticalIcon aria-hidden />}
              />
            </Tooltip>
          }
        />
      ) : null}
    </div>
  );

  if (!chromeSlot) return null;
  return createPortal(toolbar, chromeSlot);
}
