import { LazyStore } from "@tauri-apps/plugin-store";
import type { BangumiUser } from "../types";

const USER_KEY = "user";
const TOKEN_EXPIRES_KEY = "tokenExpires";
const store = new LazyStore("bangumi.json");

export async function getCachedUser(): Promise<BangumiUser | null> {
  const user = await store.get<BangumiUser>(USER_KEY);
  return user ?? null;
}

export async function setCachedUser(user: BangumiUser): Promise<void> {
  await store.set(USER_KEY, user);
  await store.save();
}

export async function getCachedTokenExpires(): Promise<number | null> {
  const expires = await store.get<number>(TOKEN_EXPIRES_KEY);
  return typeof expires === "number" ? expires : null;
}

export async function setCachedTokenExpires(expires: number): Promise<void> {
  await store.set(TOKEN_EXPIRES_KEY, expires);
  await store.save();
}

export async function clearCachedSession(): Promise<void> {
  await store.delete(USER_KEY);
  await store.delete(TOKEN_EXPIRES_KEY);
  await store.save();
}
