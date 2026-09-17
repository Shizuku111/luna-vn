import { useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Dialog } from "@/components/Dialog";
import { LEPathField } from "./LEPathField";
import "./SetLEPathDialog.css";

export type SetLEPathDialogOptions = {
  title?: ReactNode;
  initialPath?: string;
  cancelText?: ReactNode;
  confirmText?: ReactNode;
};

type SetLEPathDialogViewProps = SetLEPathDialogOptions & {
  onSettle: (path: string | null) => void;
};

function SetLEPathDialogView({
  title = "设置 Locale Emulator地址",
  initialPath = "",
  cancelText = "取消",
  confirmText = "确认",
  onSettle,
}: SetLEPathDialogViewProps) {
  const [open, setOpen] = useState(true);
  const [path, setPath] = useState(initialPath);

  function finish(result: string | null) {
    setOpen(false);
    onSettle(result);
  }

  const trimmed = path.trim();

  return (
    <Dialog
      open={open}
      title={title}
      className="set-le-path-dialog"
      content={
        <LEPathField
          className="le-path-field--dialog"
          value={path}
          showClear={false}
          onChange={setPath}
        />
      }
      cancelText={cancelText}
      confirmText={confirmText}
      confirmDisabled={!trimmed}
      onClose={() => finish(null)}
      onConfirm={() => finish(trimmed)}
    />
  );
}

export function SetLEPathDialog(
  options: SetLEPathDialogOptions = {},
): Promise<string | null> {
  if (typeof document === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "set-le-path-dialog-host";
    document.body.appendChild(host);

    const root: Root = createRoot(host);
    let settled = false;

    function cleanup(path: string | null) {
      if (settled) return;
      settled = true;
      resolve(path);
      window.setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    }

    root.render(<SetLEPathDialogView {...options} onSettle={cleanup} />);
  });
}
