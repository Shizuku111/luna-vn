import {
  asInfobox,
  formatInfoboxStringValue,
} from "@/features/bangumi";

const NAME_INFOBOX_KEYS = new Set([
  "简体中文名",
  "中文名",
  "汉语",
  "汉译名",
  "别名",
  "又名",
  "译名",
  "日本名",
  "日文名",
  "英文名",
  "第二中文名",
]);

export function isNameInfoboxKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (NAME_INFOBOX_KEYS.has(trimmed)) return true;
  return (
    trimmed.includes("中文名") ||
    trimmed.includes("汉译") ||
    trimmed.includes("别名") ||
    trimmed.includes("又名") ||
    trimmed.includes("译名") ||
    trimmed === "姓名" ||
    trimmed === "名称"
  );
}

export function collectInfoboxNameTexts(infobox: unknown): string[] {
  const items = asInfobox(infobox);
  if (!items) return [];

  const texts: string[] = [];
  for (const item of items) {
    if (!isNameInfoboxKey(item.key)) continue;
    const text = formatInfoboxStringValue(item.value);
    if (text) texts.push(text);
  }
  return texts;
}

export function collectEntityNameTexts(input: {
  name?: string | null;
  nameCn?: string | null;
  infobox?: unknown;
}): string[] {
  const texts = [
    input.name?.trim() ?? "",
    input.nameCn?.trim() ?? "",
    ...collectInfoboxNameTexts(input.infobox),
  ].filter(Boolean);

  return [...new Set(texts)];
}

export function matchesNameQuery(texts: string[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;
  return texts.some((text) => text.toLowerCase().includes(normalized));
}

export function pickDisplayAltName(
  name: string,
  texts: string[],
): string | null {
  const primary = name.trim();
  for (const text of texts) {
    if (text && text !== primary) return text;
  }
  return null;
}
