import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

export async function getLaunchAtStartup(): Promise<boolean> {
  try {
    return await isEnabled();
  } catch {
    return false;
  }
}

export async function setLaunchAtStartup(enabled: boolean): Promise<void> {
  if (enabled) {
    await enable();
    return;
  }
  await disable();
}
