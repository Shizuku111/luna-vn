import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, LoadingIcon } from "@/components/icons";
import { Button, type ButtonTheme } from "../Button";
import "./Dialog.css";

export type DialogProps = {
  open: boolean;
  title?: ReactNode;
  content?: ReactNode;
  footer?: ReactNode;
  cancelText?: ReactNode;
  confirmText?: ReactNode;
  confirmTheme?: ButtonTheme;
  onClose?: () => void;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  className?: string;
};

export function Dialog({
  open,
  title,
  content,
  footer,
  cancelText = "取消",
  confirmText = "确认",
  confirmTheme = "primary",
  onClose,
  onConfirm,
  confirmDisabled = false,
  confirmLoading = false,
  className,
}: DialogProps) {
  if (!open || typeof document === "undefined") {
    return null;
  }

  const confirmBusy = confirmDisabled || confirmLoading;

  function handleClose() {
    if (confirmLoading) return;
    onClose?.();
  }

  const resolvedFooter =
    footer !== undefined ? (
      footer
    ) : (
      <div className="ui-dialog-footer-actions">
        <Button
          round
          content={cancelText}
          disabled={confirmLoading}
          onClick={handleClose}
        />
        <Button
          theme={confirmTheme}
          round
          prefix={
            confirmLoading ? (
              <LoadingIcon className="is-spinning" aria-hidden />
            ) : undefined
          }
          content={confirmText}
          disabled={confirmBusy}
          onClick={onConfirm}
        />
      </div>
    );

  return createPortal(
    <div className="ui-dialog-root" role="presentation">
      <button
        type="button"
        className="ui-dialog-mask"
        aria-label="关闭对话框"
        disabled={confirmLoading}
        onClick={handleClose}
      />
      <div
        className={["ui-dialog", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-busy={confirmLoading || undefined}
        aria-label={typeof title === "string" ? title : undefined}
      >
        <button
          type="button"
          className="ui-dialog-close"
          aria-label="关闭"
          disabled={confirmLoading}
          onClick={handleClose}
        >
          <CloseIcon aria-hidden />
        </button>

        {title != null ? <header className="ui-dialog-header">{title}</header> : null}
        <div className="ui-dialog-body">{content}</div>
        {resolvedFooter != null ? (
          <footer className="ui-dialog-footer">{resolvedFooter}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
