import { useEffect, useId, useRef, useState } from "react";
import { FilterSortIcon } from "@/components/icons";
import { LIBRARY_GAME_STATUS_OPTIONS } from "@/features/library";
import "./LibraryViewPanel.css";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "全部" },
  ...LIBRARY_GAME_STATUS_OPTIONS.map((option) => ({
    value: String(option.value),
    label: option.label,
  })),
] as const;

const SORT_OPTIONS = [
  { value: "recent", label: "最近游玩" },
  { value: "added", label: "添加时间" },
  { value: "released", label: "发行日期" },
  { value: "name", label: "名称" },
] as const;

export type StatusFilterValue = (typeof STATUS_FILTER_OPTIONS)[number]["value"];
export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

type LibraryViewPanelProps = {
  statusFilter: StatusFilterValue;
  sortBy: SortValue;
  ascending: boolean;
  favoritesOnly: boolean;
  wishlistFirst: boolean;
  active?: boolean;
  onStatusChange: (value: StatusFilterValue) => void;
  onSortChange: (value: SortValue) => void;
  onAscendingChange: (value: boolean) => void;
  onFavoritesOnlyChange: (value: boolean) => void;
  onWishlistFirstChange: (value: boolean) => void;
};

export function LibraryViewPanel({
  statusFilter,
  sortBy,
  ascending,
  favoritesOnly,
  wishlistFirst,
  active = false,
  onStatusChange,
  onSortChange,
  onAscendingChange,
  onFavoritesOnlyChange,
  onWishlistFirstChange,
}: LibraryViewPanelProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? "排序";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`library-view-panel${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className={[
          "library-toolbar-trigger",
          active || open ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={`筛选与排序，当前：${sortLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <FilterSortIcon
          className="library-toolbar-trigger-icon"
          aria-hidden
        />
        <span className="library-toolbar-trigger-label">{sortLabel}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="library-view-sheet"
          role="dialog"
          aria-label="筛选与排序"
        >
          <section className="library-view-section">
            <h2 className="library-view-section-title">状态</h2>
            <div className="library-view-chips" role="radiogroup" aria-label="状态">
              {STATUS_FILTER_OPTIONS.map((option) => {
                const selected = statusFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={[
                      "library-view-chip",
                      selected ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onStatusChange(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="library-view-section">
            <h2 className="library-view-section-title">偏好</h2>
            <div className="library-view-chips" role="group" aria-label="偏好">
              <button
                type="button"
                aria-pressed={wishlistFirst}
                className={[
                  "library-view-chip",
                  wishlistFirst ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onWishlistFirstChange(!wishlistFirst)}
              >
                想玩优先
              </button>
              <button
                type="button"
                aria-pressed={favoritesOnly}
                className={[
                  "library-view-chip",
                  favoritesOnly ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
              >
                只显示喜欢
              </button>
            </div>
          </section>

          <section className="library-view-section">
            <h2 className="library-view-section-title">排序类型</h2>
            <div
              className="library-view-chips"
              role="radiogroup"
              aria-label="排序类型"
            >
              {SORT_OPTIONS.map((option) => {
                const selected = sortBy === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={[
                      "library-view-chip",
                      selected ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onSortChange(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="library-view-section">
            <h2 className="library-view-section-title">排序方式</h2>
            <div
              className="library-view-chips"
              role="radiogroup"
              aria-label="排序方式"
            >
              <button
                type="button"
                role="radio"
                aria-checked={!ascending}
                className={[
                  "library-view-chip",
                  !ascending ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onAscendingChange(false)}
              >
                从新到旧
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={ascending}
                className={[
                  "library-view-chip",
                  ascending ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onAscendingChange(true)}
              >
                从旧到新
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
