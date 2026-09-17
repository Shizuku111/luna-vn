import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CloseConfirmDialog } from "./components/CloseConfirmDialog";
import {
  CloseBehavior,
  getCloseBehavior,
  setCloseBehavior,
  type CloseBehaviorValue,
} from "./storage/settingsStore";

let handlingClose = false;

async function minimizeToTray(): Promise<void> {
  await getCurrentWindow().hide();
}

async function exitApp(): Promise<void> {
  await invoke("quit_app");
}

async function applyCloseAction(
  action: Exclude<CloseBehaviorValue, "ask">,
): Promise<void> {
  if (action === CloseBehavior.Tray) {
    await minimizeToTray();
    return;
  }
  await exitApp();
}

export async function handleAppCloseRequest(): Promise<void> {
  if (handlingClose) return;
  handlingClose = true;
  try {
    const behavior = await getCloseBehavior();
    if (behavior === CloseBehavior.Tray || behavior === CloseBehavior.Exit) {
      await applyCloseAction(behavior);
      return;
    }

    const result = await CloseConfirmDialog();
    if (!result) return;

    if (result.remember) {
      await setCloseBehavior(result.action);
    }
    await applyCloseAction(result.action);
  } finally {
    handlingClose = false;
  }
}
