import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { MouseEvent } from "react";
import { CloseIcon } from "@/components/icons";
import { Input } from "@/components/Input";
import "./LEPathField.css";

export type LEPathFieldProps = {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  showClear?: boolean;
  className?: string;
};

export function LEPathField({
  value,
  onChange,
  disabled = false,
  showClear = true,
  className = "",
}: LEPathFieldProps) {
  async function handlePick() {
    if (disabled) return;
    const selected = await openDialog({
      title: "选择 Locale Emulator",
      multiple: false,
      directory: false,
      filters: [{ name: "可执行文件", extensions: ["exe"] }],
    });
    if (typeof selected === "string") {
      onChange(selected);
    }
  }

  function handlePickClick() {
    void handlePick();
  }

  function handleClear(event: MouseEvent) {
    event.stopPropagation();
    onChange("");
  }

  return (
    <div
      className={["le-path-field", className].filter(Boolean).join(" ")}
    >
      <div className="le-path-field-text">
        <span className="le-path-field-label">Locale Emulator地址</span>
        <span className="le-path-field-hint">
          选择 Locale Emulator 文件夹中的 LEProc.exe 文件
        </span>
      </div>
      <div className="le-path-field-control">
        <Input
          className="le-path-field-input"
          value={value}
          readOnly
          placeholder="点击选择 LEProc.exe"
          aria-label="Locale Emulator地址"
          title={value || undefined}
          disabled={disabled}
          onClick={handlePickClick}
        />
        {showClear && value ? (
          <button
            type="button"
            className="le-path-field-clear"
            aria-label="清除 Locale Emulator地址"
            disabled={disabled}
            onClick={handleClear}
          >
            <CloseIcon aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
