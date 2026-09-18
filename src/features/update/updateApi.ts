import { invoke } from "@tauri-apps/api/core";

export type AppUpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl: string | null;
  releaseName: string | null;
  htmlUrl: string | null;
};

export async function checkAppUpdate(): Promise<AppUpdateInfo> {
  return invoke<AppUpdateInfo>("check_app_update");
}

export async function downloadAndInstallUpdate(url: string): Promise<void> {
  await invoke("download_and_install_update", { url });
}
