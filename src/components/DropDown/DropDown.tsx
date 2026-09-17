import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import "./DropDown.css";

export type DropDownOption<T extends string = string> = {
  value: T;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  keepOpen?: boolean;
};

type DropDownProps<T extends string = string> = {
  trigger: ReactNode;
  options: DropDownOption<T>[];
  onSelect: (value: T) => void;
  placement?: "bottom-start" | "bottom-end" | "left-start" | "left-end";
  className?: string;
};

export function DropDown<T extends string = string>({
  trigger,
  options,
  onSelect,
  placement = "bottom-start",
  className = "",
}: DropDownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

  function handleTriggerClick() {
    setOpen((current) => !current);
  }

  function handleSelectOption(option: DropDownOption<T>) {
    if (option.disabled || option.separator) return;
    onSelect(option.value);
    if (!option.keepOpen) setOpen(false);
  }

  const showChecks = options.some(
    (option) => !option.separator && option.checked !== undefined,
  );

  return (
    <div
      ref={rootRef}
      className={`dropdown${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
    >
      <div
        className="dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={handleTriggerClick}
      >
        {trigger}
      </div>

      {open ? (
        <div
          className={`dropdown-panel dropdown-panel--${placement}`}
          role="presentation"
        >
          <ul id={menuId} className="dropdown-list" role="menu">
            {options.map((option) => {
              if (option.separator) {
                return (
                  <li
                    key={option.value}
                    className="dropdown-separator"
                    role="separator"
                  />
                );
              }

              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role={showChecks ? "menuitemcheckbox" : "menuitem"}
                    aria-checked={
                      showChecks ? option.checked === true : undefined
                    }
                    className={[
                      "dropdown-option",
                      option.checked ? "is-checked" : "",
                      option.danger ? "is-danger" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={option.disabled}
                    onClick={() => handleSelectOption(option)}
                  >
                    {showChecks ? (
                      <span className="dropdown-option-check" aria-hidden>
                        {option.checked ? <CheckIcon /> : null}
                      </span>
                    ) : null}
                    <span className="dropdown-option-label">{option.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
