import { invoke } from "@tauri-apps/api/core";

export async function clearLibraryData(): Promise<void> {
  await invoke("clear_library_data");
}

export async function clearImageCache(): Promise<void> {
  await invoke("clear_image_cache");
}

export async function openImageCacheDir(): Promise<void> {
  await invoke("open_image_cache_dir");
}
