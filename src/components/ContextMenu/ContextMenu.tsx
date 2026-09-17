import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import "./ContextMenu.css";

export type ContextMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ContextMenuItem[];
  onSelect?: () => void;
};

export type ContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

const SUBMENU_CLOSE_DELAY_MS = 180;
const VIEWPORT_PADDING = 8;
const SUBMENU_DEFAULT_TOP = -6;

export function ContextMenu({ open, x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const closeSubmenuTimerRef = useRef<number | null>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [openSubKey, setOpenSubKey] = useState<string | null>(null);
  const [submenuSide, setSubmenuSide] = useState<"right" | "left">("right");
  const [submenuTop, setSubmenuTop] = useState(SUBMENU_DEFAULT_TOP);

  function clearCloseSubmenuTimer() {
    if (closeSubmenuTimerRef.current != null) {
      window.clearTimeout(closeSubmenuTimerRef.current);
      closeSubmenuTimerRef.current = null;
    }
  }

  function openSubmenu(key: string, side: "right" | "left") {
    clearCloseSubmenuTimer();
    setSubmenuSide(side);
    setSubmenuTop(SUBMENU_DEFAULT_TOP);
    setOpenSubKey(key);
  }

  function scheduleCloseSubmenu(key: string) {
    clearCloseSubmenuTimer();
    closeSubmenuTimerRef.current = window.setTimeout(() => {
      setOpenSubKey((current) => (current === key ? null : current));
      closeSubmenuTimerRef.current = null;
    }, SUBMENU_CLOSE_DELAY_MS);
  }

  useLayoutEffect(() => {
    if (!open) {
      clearCloseSubmenuTimer();
      setOpenSubKey(null);
      return;
    }

    const menu = menuRef.current;
    if (!menu) {
      setPosition({ left: x, top: y });
      return;
    }

    const rect = menu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - VIEWPORT_PADDING);
    const top = Math.min(y, window.innerHeight - rect.height - VIEWPORT_PADDING);

    setPosition({
      left: Math.max(VIEWPORT_PADDING, left),
      top: Math.max(VIEWPORT_PADDING, top),
    });
  }, [open, x, y, items.length]);

  useLayoutEffect(() => {
    if (!open || !openSubKey) return;

    const submenu = submenuRef.current;
    if (!submenu) return;

    const wrap = submenu.parentElement;
    if (!wrap) return;

    const wrapRect = wrap.getBoundingClientRect();
    const width = submenu.offsetWidth;
    const height = submenu.offsetHeight;
    const spaceRight = window.innerWidth - VIEWPORT_PADDING - wrapRect.right;
    const spaceLeft = wrapRect.left - VIEWPORT_PADDING;
    const nextSide =
      spaceRight >= width
        ? "right"
        : spaceLeft >= width
          ? "left"
          : spaceRight >= spaceLeft
            ? "right"
            : "left";

    let nextTop = SUBMENU_DEFAULT_TOP;
    const maxBottom = window.innerHeight - VIEWPORT_PADDING;
    const minTop = VIEWPORT_PADDING;

    if (wrapRect.top + nextTop + height > maxBottom) {
      nextTop = maxBottom - height - wrapRect.top;
    }
    if (wrapRect.top + nextTop < minTop) {
      nextTop = minTop - wrapRect.top;
    }

    setSubmenuSide(nextSide);
    setSubmenuTop(nextTop);
  }, [open, openSubKey]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    function handleScroll() {
      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", onClose);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      clearCloseSubmenuTimer();
    };
  }, []);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="ui-context-menu"
      role="menu"
      style={{ left: position.left, top: position.top }}
    >
      <ul className="ui-context-menu-list">
        {items.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          const submenuOpen = openSubKey === item.key;

          return (
            <li
              key={item.key}
              className={[
                "ui-context-menu-item-wrap",
                hasChildren ? "has-submenu" : "",
                submenuOpen ? "is-submenu-open" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role="presentation"
              onMouseEnter={(event) => {
                if (!hasChildren || item.disabled) {
                  clearCloseSubmenuTimer();
                  setOpenSubKey(null);
                  return;
                }

                const rect = event.currentTarget.getBoundingClientRect();
                const estimatedWidth = 168;
                const fitsRight =
                  rect.right + estimatedWidth <=
                  window.innerWidth - VIEWPORT_PADDING;
                openSubmenu(item.key, fitsRight ? "right" : "left");
              }}
              onMouseLeave={() => {
                if (hasChildren) {
                  scheduleCloseSubmenu(item.key);
                }
              }}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup={hasChildren ? "menu" : undefined}
                aria-expanded={hasChildren ? submenuOpen : undefined}
                className={[
                  "ui-context-menu-item",
                  item.danger ? "is-danger" : "",
                  hasChildren ? "has-children" : "",
                  item.className ?? "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled || hasChildren) return;
                  item.onSelect?.();
                  onClose();
                }}
              >
                {item.checked != null ? (
                  <span className="ui-context-menu-item-check" aria-hidden>
                    {item.checked ? <CheckIcon /> : null}
                  </span>
                ) : null}
                {item.icon ? (
                  <span className="ui-context-menu-item-icon" aria-hidden>
                    {item.icon}
                  </span>
                ) : null}
                <span className="ui-context-menu-item-label">{item.label}</span>
                {hasChildren ? (
                  <span className="ui-context-menu-item-arrow" aria-hidden>
                    <ChevronRightIcon />
                  </span>
                ) : null}
              </button>

              {hasChildren && submenuOpen ? (
                <div
                  ref={submenuRef}
                  className={`ui-context-submenu ui-context-submenu--${submenuSide}`}
                  role="menu"
                  style={{ top: submenuTop }}
                  onMouseEnter={clearCloseSubmenuTimer}
                >
                  <ul className="ui-context-menu-list">
                    {item.children!.map((child) => (
                      <li key={child.key} role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          className={[
                            "ui-context-menu-item",
                            child.danger ? "is-danger" : "",
                            child.checked ? "is-checked" : "",
                            child.className ?? "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          disabled={child.disabled}
                          onClick={() => {
                            if (child.disabled) return;
                            child.onSelect?.();
                            onClose();
                          }}
                        >
                          {child.checked != null ? (
                            <span
                              className="ui-context-menu-item-check"
                              aria-hidden
                            >
                              {child.checked ? <CheckIcon /> : null}
                            </span>
                          ) : null}
                          {child.icon ? (
                            <span
                              className="ui-context-menu-item-icon"
                              aria-hidden
                            >
                              {child.icon}
                            </span>
                          ) : null}
                          <span className="ui-context-menu-item-label">
                            {child.label}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}
