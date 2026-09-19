import { useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { CloseIcon, SelectAppIcon } from "@/components/icons";
import { parentDirectory } from "@/utils/filePath";
import "./PickLaunchExeDialog.css";

export type PickLaunchExeDialogOptions = {
  title?: ReactNode;
  initialPath?: string;
  cancelText?: ReactNode;
  confirmText?: ReactNode;
};

type PickLaunchExeDialogViewProps = PickLaunchExeDialogOptions & {
  onSettle: (path: string | null) => void;
};

function PickLaunchExeDialogView({
  title = "选择启动程序",
  initialPath = "",
  cancelText = "取消",
  confirmText = "确认",
  onSettle,
}: PickLaunchExeDialogViewProps) {
  const [open, setOpen] = useState(true);
  const [path, setPath] = useState(initialPath);

  function finish(result: string | null) {
    setOpen(false);
    onSettle(result);
  }

  async function handlePick() {
    const selected = await openDialog({
      title: "选择启动程序",
      multiple: false,
      directory: false,
      defaultPath: parentDirectory(path),
      filters: [{ name: "可执行文件", extensions: ["exe"] }],
    });
    if (typeof selected === "string") {
      setPath(selected);
    }
  }

  const trimmed = path.trim();

  return (
    <Dialog
      open={open}
      title={title}
      className="pick-launch-exe-dialog"
      content={
        <div className="pick-launch-exe-field">
          <Button
            theme="primary"
            round
            prefix={<SelectAppIcon aria-hidden />}
            content={trimmed ? "重新选择" : "选择启动程序"}
            onClick={() => {
              void handlePick();
            }}
          />
          {trimmed ? (
            <div className="pick-launch-exe-path">
              <span className="pick-launch-exe-path-text" title={trimmed}>
                {trimmed}
              </span>
              <button
                type="button"
                className="pick-launch-exe-path-clear"
                aria-label="清除启动程序"
                onClick={() => setPath("")}
              >
                <CloseIcon aria-hidden />
              </button>
            </div>
          ) : (
            <p className="pick-launch-exe-hint">请选择游戏启动用的 .exe 文件</p>
          )}
        </div>
      }
      cancelText={cancelText}
      confirmText={confirmText}
      confirmDisabled={!trimmed}
      onClose={() => finish(null)}
      onConfirm={() => finish(trimmed)}
    />
  );
}

export function PickLaunchExeDialog(
  options: PickLaunchExeDialogOptions = {},
): Promise<string | null> {
  if (typeof document === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "pick-launch-exe-dialog-host";
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

    root.render(<PickLaunchExeDialogView {...options} onSettle={cleanup} />);
  });
}
