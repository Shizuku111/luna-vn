import { useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Dialog } from "@/components/Dialog";
import { Radio } from "@/components/Radio";
import { CloseBehavior, type CloseBehaviorValue } from "../storage/settingsStore";
import "./CloseConfirmDialog.css";

export type CloseConfirmResult = {
  action: Exclude<CloseBehaviorValue, "ask">;
  remember: boolean;
};

type CloseConfirmDialogViewProps = {
  title?: ReactNode;
  onSettle: (result: CloseConfirmResult | null) => void;
};

function CloseConfirmDialogView({
  title = "关闭应用",
  onSettle,
}: CloseConfirmDialogViewProps) {
  const [open, setOpen] = useState(true);
  const [action, setAction] = useState<Exclude<CloseBehaviorValue, "ask">>(
    CloseBehavior.Tray,
  );
  const [remember, setRemember] = useState(false);

  function finish(result: CloseConfirmResult | null) {
    setOpen(false);
    onSettle(result);
  }

  return (
    <Dialog
      open={open}
      title={title}
      className="close-confirm-dialog"
      content={
        <div
          className="close-confirm-radios"
          role="radiogroup"
          aria-label="关闭方式"
        >
          <Radio
            name="close-behavior"
            value={CloseBehavior.Exit}
            checked={action === CloseBehavior.Exit}
            onChange={() => setAction(CloseBehavior.Exit)}
          >
            退出应用
          </Radio>
          <Radio
            name="close-behavior"
            value={CloseBehavior.Tray}
            checked={action === CloseBehavior.Tray}
            onChange={() => setAction(CloseBehavior.Tray)}
          >
            最小化到托盘
          </Radio>
        </div>
      }
      footer={
        <div className="close-confirm-footer">
          <Checkbox muted checked={remember} onChange={setRemember}>
            不再提醒
          </Checkbox>
          <div className="ui-dialog-footer-actions">
            <Button round content="取消" onClick={() => finish(null)} />
            <Button
              theme="primary"
              round
              content="确认"
              onClick={() => finish({ action, remember })}
            />
          </div>
        </div>
      }
      onClose={() => finish(null)}
    />
  );
}

export function CloseConfirmDialog(): Promise<CloseConfirmResult | null> {
  if (typeof document === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "close-confirm-dialog-host";
    document.body.appendChild(host);

    const root: Root = createRoot(host);
    let settled = false;

    function cleanup(result: CloseConfirmResult | null) {
      if (settled) return;
      settled = true;
      resolve(result);
      window.setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    }

    root.render(<CloseConfirmDialogView onSettle={cleanup} />);
  });
}
