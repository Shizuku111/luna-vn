import { invoke } from "@tauri-apps/api/core";
import { clearGameCoverCache } from "@/features/library/gameCoverCache";

export async function clearLibraryData(): Promise<void> {
  await invoke("clear_library_data");
  clearGameCoverCache();
}

export async function clearImageCache(): Promise<void> {
  await invoke("clear_image_cache");
  clearGameCoverCache();
}

export async function openImageCacheDir(): Promise<void> {
  await invoke("open_image_cache_dir");
}
