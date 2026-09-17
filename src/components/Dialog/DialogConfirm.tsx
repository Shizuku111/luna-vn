import { useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ButtonTheme } from "@/components/Button";
import { Dialog } from "./Dialog";

export type DialogConfirmOptions = {
  title?: ReactNode;
  content?: ReactNode;
  cancelText?: ReactNode;
  confirmText?: ReactNode;
  confirmTheme?: ButtonTheme;
  className?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
};

type ConfirmDialogProps = DialogConfirmOptions & {
  onSettle: (confirmed: boolean) => void;
};

function ConfirmDialog({
  title = "确认",
  content,
  cancelText = "取消",
  confirmText = "确认",
  confirmTheme = "primary",
  className,
  onConfirm,
  onCancel,
  onSettle,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(true);
  const [confirmLoading, setConfirmLoading] = useState(false);

  function finish(confirmed: boolean) {
    setOpen(false);
    onSettle(confirmed);
  }

  function handleClose() {
    if (confirmLoading) return;
    onCancel?.();
    finish(false);
  }

  function handleConfirm() {
    if (confirmLoading) return;
    void (async () => {
      setConfirmLoading(true);
      try {
        await onConfirm?.();
        finish(true);
      } catch {
        setConfirmLoading(false);
      }
    })();
  }

  return (
    <Dialog
      open={open}
      title={title}
      content={content}
      cancelText={cancelText}
      confirmText={confirmText}
      confirmTheme={confirmTheme}
      confirmLoading={confirmLoading}
      className={["ui-dialog--confirm", className].filter(Boolean).join(" ")}
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  );
}

export function DialogConfirm(options: DialogConfirmOptions): Promise<boolean> {
  if (typeof document === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "ui-dialog-confirm-host";
    document.body.appendChild(host);

    const root: Root = createRoot(host);
    let settled = false;

    function cleanup(confirmed: boolean) {
      if (settled) return;
      settled = true;
      resolve(confirmed);
      window.setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    }

    root.render(<ConfirmDialog {...options} onSettle={cleanup} />);
  });
}
