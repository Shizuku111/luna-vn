import {
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { CloseIcon } from "@/components/icons";
import "./Input.css";

export type InputSize = "small" | "medium" | "large";

type InputProps = {
  size?: InputSize;
  prefix?: ReactNode;
  clearable?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix">;

export function Input({
  size = "medium",
  prefix,
  clearable = false,
  className = "",
  type = "text",
  value,
  defaultValue,
  onChange,
  disabled,
  readOnly,
  ...rest
}: InputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(
    () => defaultValue ?? "",
  );

  const currentValue = isControlled ? value : uncontrolledValue;
  const hasValue = String(currentValue ?? "").length > 0;
  const showClear = clearable && hasValue && !disabled && !readOnly;

  const wrapClass = [
    "ui-input-wrap",
    `ui-input-wrap--${size}`,
    prefix ? "has-prefix" : "",
    showClear ? "has-clear" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (!isControlled) {
      setUncontrolledValue(event.target.value);
    }
    onChange?.(event);
  }

  function handleClear(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!isControlled) {
      setUncontrolledValue("");
    }

    onChange?.({
      target: { value: "" },
      currentTarget: { value: "" },
    } as ChangeEvent<HTMLInputElement>);

    inputRef.current?.focus();
  }

  const inputValueProps = isControlled
    ? { value }
    : clearable
      ? { value: uncontrolledValue }
      : { defaultValue };

  return (
    <div className={wrapClass}>
      {prefix ? (
        <span className="ui-input-prefix" aria-hidden>
          {prefix}
        </span>
      ) : null}
      <input
        ref={inputRef}
        type={type}
        className="ui-input"
        disabled={disabled}
        readOnly={readOnly}
        onChange={handleChange}
        {...inputValueProps}
        {...rest}
      />
      {showClear ? (
        <button
          type="button"
          className="ui-input-clear"
          aria-label="清空"
          tabIndex={-1}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={handleClear}
        >
          <CloseIcon aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
