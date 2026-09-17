import "./Switch.css";

export type SwitchProps = {
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  "aria-label"?: string;
  className?: string;
};

export function Switch({
  checked = false,
  disabled = false,
  onChange,
  className = "",
  "aria-label": ariaLabel,
}: SwitchProps) {
  const classes = [
    "ui-switch",
    checked ? "is-checked" : "",
    disabled ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function handleClick() {
    if (disabled) return;
    onChange?.(!checked);
  }

  return (
    <button
      type="button"
      role="switch"
      className={classes}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
    >
      <span className="ui-switch-thumb" aria-hidden />
    </button>
  );
}
