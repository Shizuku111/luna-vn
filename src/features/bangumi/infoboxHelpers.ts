import type { BangumiInfoboxItem, BangumiInfoboxValueEntry } from "./types";

export const NAME_CN_KEYS = ["简体中文名", "中文名", "汉语", "汉译名"] as const;

const NAME_CN_KEY_SET = new Set<string>(NAME_CN_KEYS);

function normalizeInfoboxValueEntry(
  entry: unknown,
): BangumiInfoboxValueEntry | null {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  if (typeof record.v !== "string") return null;
  const next: BangumiInfoboxValueEntry = { v: record.v };
  if (typeof record.k === "string") next.k = record.k;
  return next;
}

function normalizeInfoboxValue(
  value: unknown,
): BangumiInfoboxItem["value"] | null {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (!Array.isArray(value)) return null;

  const entries: BangumiInfoboxValueEntry[] = [];
  for (const entry of value) {
    const normalized = normalizeInfoboxValueEntry(entry);
    if (normalized != null) entries.push(normalized);
  }
  return entries;
}

export function asInfobox(value: unknown): BangumiInfoboxItem[] | null {
  if (!Array.isArray(value)) return null;

  const items: BangumiInfoboxItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.key !== "string") continue;
    const normalized = normalizeInfoboxValue(record.value);
    if (normalized == null) continue;
    items.push({ key: record.key, value: normalized });
  }
  return items;
}

export function formatInfoboxStringValue(
  value: BangumiInfoboxItem["value"],
): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";

  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object" && "v" in entry) {
        return String(entry.v ?? "").trim();
      }
      return "";
    })
    .filter(Boolean)
    .join("、");
}

export function findInfoboxValue(
  infobox: BangumiInfoboxItem[] | null | undefined,
  keys: readonly string[],
): string {
  if (!infobox?.length) return "";

  for (const key of keys) {
    for (const item of infobox) {
      if (item.key !== key) continue;
      const text = formatInfoboxStringValue(item.value);
      if (text) return text;
    }
  }
  return "";
}

export function isNameCnKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (NAME_CN_KEY_SET.has(trimmed)) return true;
  return trimmed.includes("中文名") || trimmed.includes("汉译");
}
