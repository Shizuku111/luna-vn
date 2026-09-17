import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "@/components/icons";
import "./Select.css";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

export type SelectSize = "small" | "medium" | "large";

type SelectProps<T extends string = string> = {
  label?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  size?: SelectSize;
  className?: string;
  title?: string;
  disabled?: boolean;
};

const VIEWPORT_PADDING = 8;
const PANEL_GAP = 6;
const PANEL_MAX_HEIGHT = 240;

export function Select<T extends string = string>({
  label,
  value,
  options,
  onChange,
  size = "medium",
  className = "",
  title,
  disabled = false,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;

    function updatePanelPosition() {
      const trigger = rootRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, 140);
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
      const spaceAbove = rect.top - VIEWPORT_PADDING;
      const openUpward =
        spaceBelow < Math.min(PANEL_MAX_HEIGHT, 160) && spaceAbove > spaceBelow;
      const maxHeight = Math.min(
        PANEL_MAX_HEIGHT,
        Math.max(120, openUpward ? spaceAbove - PANEL_GAP : spaceBelow - PANEL_GAP),
      );

      let left = rect.left;
      if (left + width > window.innerWidth - VIEWPORT_PADDING) {
        left = Math.max(
          VIEWPORT_PADDING,
          window.innerWidth - VIEWPORT_PADDING - width,
        );
      }

      setPanelStyle(
        openUpward
          ? {
              position: "fixed",
              left,
              width,
              bottom: window.innerHeight - rect.top + PANEL_GAP,
              top: "auto",
              maxHeight,
              zIndex: 2300,
            }
          : {
              position: "fixed",
              left,
              width,
              top: rect.bottom + PANEL_GAP,
              bottom: "auto",
              maxHeight,
              zIndex: 2300,
            },
      );
    }

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, options.length, value]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
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

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  function handleSelectOption(next: T) {
    onChange(next);
    setOpen(false);
  }

  function handleTriggerClick() {
    if (disabled) return;
    setOpen((current) => !current);
  }

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            className="select-panel select-panel--portal"
            role="presentation"
            style={panelStyle}
          >
            <ul id={listboxId} className="select-list" role="listbox">
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`select-option${isSelected ? " is-selected" : ""}`}
                      title={option.label}
                      onClick={() => handleSelectOption(option.value)}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`select select--${size}${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        title={title ?? selected?.label ?? value}
        onClick={handleTriggerClick}
      >
        {label ? <span className="select-label">{label}</span> : null}
        <span className="select-value">{selected?.label ?? value}</span>
        <ChevronDownIcon
          className={`select-chevron${open ? " is-open" : ""}`}
          aria-hidden
        />
      </button>
      {panel}
    </div>
  );
}
