import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { handleAppCloseRequest } from "./handleAppCloseRequest";

export function CloseBehaviorBootstrap() {
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      const dispose = await getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        await handleAppCloseRequest();
      });
      if (cancelled) {
        dispose();
        return;
      }
      unlisten = dispose;
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return null;
}
