import { DialogConfirm } from "@/components/Dialog";
import { SetLEPathDialog } from "./components/SetLEPathDialog";
import { getLEPath, setLEPath } from "./storage/settingsStore";

export async function ensureLEPathConfigured(): Promise<boolean> {
  const existing = (await getLEPath()).trim();
  if (existing) return true;

  const shouldSetup = await DialogConfirm({
    title: "未设置 Locale Emulator",
    content: "尚未设置 Locale Emulator 地址，是否立即设置？",
    confirmText: "立即设置",
  });
  if (!shouldSetup) return false;

  const selected = await SetLEPathDialog();
  if (!selected) return false;

  await setLEPath(selected);
  return true;
}

export async function offerLEPathSetup(): Promise<void> {
  const existing = (await getLEPath()).trim();
  if (existing) return;

  const shouldSetup = await DialogConfirm({
    title: "未设置 Locale Emulator",
    content: "尚未设置 Locale Emulator 地址，是否立即设置？",
    confirmText: "立即设置",
  });
  if (!shouldSetup) return;

  const selected = await SetLEPathDialog();
  if (!selected) return;

  await setLEPath(selected);
}
