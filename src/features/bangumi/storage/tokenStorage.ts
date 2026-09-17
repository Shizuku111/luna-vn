import { invoke } from "@tauri-apps/api/core";

let memoryToken: string | null | undefined;

export async function getStoredToken(): Promise<string | null> {
  if (memoryToken !== undefined) {
    return memoryToken;
  }

  const token = await invoke<string | null>("get_bangumi_token");
  memoryToken = token;
  return token;
}

export async function setStoredToken(token: string): Promise<void> {
  memoryToken = token;
  await invoke("set_bangumi_token", { token });
}

export async function deleteStoredToken(): Promise<void> {
  memoryToken = null;
  await invoke("delete_bangumi_token");
}
