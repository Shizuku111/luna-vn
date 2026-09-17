import { LazyStore } from "@tauri-apps/plugin-store";

const SHOW_NSFW_KEY = "showNsfw";
const SHOW_ORIGINAL_NAME_KEY = "showOriginalName";
const APPEARANCE_KEY = "appearance";
const LE_PATH_KEY = "LEPath";
const CLOSE_BEHAVIOR_KEY = "closeBehavior";
const BANGUMI_MAX_CONCURRENT_KEY = "bangumiMaxConcurrent";
const store = new LazyStore("settings.json");

export const BANGUMI_MAX_CONCURRENT_DEFAULT = 5;
export const BANGUMI_MAX_CONCURRENT_MIN = 1;
export const BANGUMI_MAX_CONCURRENT_MAX = 10;

export function clampBangumiMaxConcurrent(value: number): number {
  if (!Number.isFinite(value)) return BANGUMI_MAX_CONCURRENT_DEFAULT;
  const truncated = Math.trunc(value);
  if (truncated < BANGUMI_MAX_CONCURRENT_MIN) return BANGUMI_MAX_CONCURRENT_MIN;
  if (truncated > BANGUMI_MAX_CONCURRENT_MAX) return BANGUMI_MAX_CONCURRENT_MAX;
  return truncated;
}

export const AppearanceMode = {
  Light: "light",
  Dark: "dark",
  System: "system",
} as const;

export type AppearanceModeValue =
  (typeof AppearanceMode)[keyof typeof AppearanceMode];

export const APPEARANCE_MODE_OPTIONS: {
  value: AppearanceModeValue;
  label: string;
}[] = [
  { value: AppearanceMode.Light, label: "白天" },
  { value: AppearanceMode.Dark, label: "夜间" },
  { value: AppearanceMode.System, label: "跟随系统" },
];

export const CloseBehavior = {
  Ask: "ask",
  Tray: "tray",
  Exit: "exit",
} as const;

export type CloseBehaviorValue =
  (typeof CloseBehavior)[keyof typeof CloseBehavior];

export const CLOSE_BEHAVIOR_OPTIONS: {
  value: CloseBehaviorValue;
  label: string;
}[] = [
  { value: CloseBehavior.Ask, label: "始终询问" },
  { value: CloseBehavior.Tray, label: "最小化到系统托盘" },
  { value: CloseBehavior.Exit, label: "退出应用" },
];

function isAppearanceMode(value: unknown): value is AppearanceModeValue {
  return (
    value === AppearanceMode.Light ||
    value === AppearanceMode.Dark ||
    value === AppearanceMode.System
  );
}

function isCloseBehavior(value: unknown): value is CloseBehaviorValue {
  return (
    value === CloseBehavior.Ask ||
    value === CloseBehavior.Tray ||
    value === CloseBehavior.Exit
  );
}

export async function getShowNsfw(): Promise<boolean> {
  const value = await store.get<boolean>(SHOW_NSFW_KEY);
  return typeof value === "boolean" ? value : true;
}

export async function setShowNsfw(showNsfw: boolean): Promise<void> {
  await store.set(SHOW_NSFW_KEY, showNsfw);
  await store.save();
}

export async function getShowOriginalName(): Promise<boolean> {
  const value = await store.get<boolean>(SHOW_ORIGINAL_NAME_KEY);
  return typeof value === "boolean" ? value : true;
}

export async function setShowOriginalName(
  showOriginalName: boolean,
): Promise<void> {
  await store.set(SHOW_ORIGINAL_NAME_KEY, showOriginalName);
  await store.save();
}

export async function getAppearance(): Promise<AppearanceModeValue> {
  const value = await store.get<string>(APPEARANCE_KEY);
  return isAppearanceMode(value) ? value : AppearanceMode.Light;
}

export async function setAppearance(
  appearance: AppearanceModeValue,
): Promise<void> {
  await store.set(APPEARANCE_KEY, appearance);
  await store.save();
}

export async function getLEPath(): Promise<string> {
  const value = await store.get<string>(LE_PATH_KEY);
  if (typeof value === "string") return value;
  return "";
}

export async function setLEPath(path: string): Promise<void> {
  await store.set(LE_PATH_KEY, path);
  await store.save();
}

export async function getCloseBehavior(): Promise<CloseBehaviorValue> {
  const value = await store.get<string>(CLOSE_BEHAVIOR_KEY);
  return isCloseBehavior(value) ? value : CloseBehavior.Ask;
}

export async function setCloseBehavior(
  closeBehavior: CloseBehaviorValue,
): Promise<void> {
  await store.set(CLOSE_BEHAVIOR_KEY, closeBehavior);
  await store.save();
}

export async function getBangumiMaxConcurrent(): Promise<number> {
  const value = await store.get<number>(BANGUMI_MAX_CONCURRENT_KEY);
  if (typeof value !== "number") return BANGUMI_MAX_CONCURRENT_DEFAULT;
  return clampBangumiMaxConcurrent(value);
}

export async function setBangumiMaxConcurrent(value: number): Promise<number> {
  const next = clampBangumiMaxConcurrent(value);
  await store.set(BANGUMI_MAX_CONCURRENT_KEY, next);
  await store.save();
  return next;
}
