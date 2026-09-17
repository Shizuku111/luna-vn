import type { BangumiInfoboxItem } from "./types";
import { isExternalUrl } from "@/utils/externalUrl";

const DEVELOPER_KEYS = ["开发", "开发商", "游戏开发商"] as const;
const PUBLISHER_KEYS = ["发行", "发行商"] as const;
const STUDIO_KEYS = [...DEVELOPER_KEYS, ...PUBLISHER_KEYS] as const;
const SCENARIO_KEYS = ["剧本", "脚本"] as const;
const RELEASE_DATE_KEYS = [
  "发售日",
  "发行日期",
  "发售日期",
  "上映年度",
  "放送开始",
] as const;

const VALUE_SPLIT_RE = /[、，,]/;
const NO_VALUE_SPLIT_KEYS = new Set(["售价"]);
const WIKI_LINK_RE = /^\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]*))?\]$/i;
const LABELED_URL_RE = /^(.+?)[：:](https?:\/\/\S+)$/i;

export type InfoboxDisplayValue = {
  text: string;
  href?: string;
  title?: string;
  tag?: boolean;
};

export type InfoboxDisplayRow = {
  key: string;
  values: InfoboxDisplayValue[];
};

function splitStringValue(text: string, split = true): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (!split || !VALUE_SPLIT_RE.test(trimmed)) return [trimmed];
  return trimmed
    .split(VALUE_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean);
}

function toInfoboxDisplayValue(raw: string): InfoboxDisplayValue {
  const trimmed = raw.trim();
  if (!trimmed) return { text: "" };
  if (!isExternalUrl(trimmed)) return { text: trimmed };

  const wiki = trimmed.match(WIKI_LINK_RE);
  if (wiki) {
    const href = wiki[1];
    const label = wiki[2]?.trim();
    return { text: label || href, href };
  }

  const labeled = trimmed.match(LABELED_URL_RE);
  if (labeled) {
    return { text: trimmed, href: labeled[2] };
  }

  return { text: trimmed, href: trimmed };
}

function formatInfoboxDisplayValues(
  value: BangumiInfoboxItem["value"] | undefined,
  key?: string,
): InfoboxDisplayValue[] {
  if (value == null) return [];

  const shouldSplit = !key || !NO_VALUE_SPLIT_KEYS.has(key);

  if (typeof value === "string") {
    return splitStringValue(value, shouldSplit).map(toInfoboxDisplayValue);
  }

  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return toInfoboxDisplayValue(entry);
      }
      if (entry && typeof entry === "object" && "v" in entry) {
        const rawV = String(entry.v ?? "").trim();
        const label = String(entry.k ?? "").trim();
        if (!label && !rawV) return { text: "" };

        if (isExternalUrl(rawV)) {
          const linked = toInfoboxDisplayValue(rawV);
          return {
            text: label || linked.text,
            href: linked.href,
            title: rawV || undefined,
            tag: Boolean(label),
          };
        }

        if (!label) return toInfoboxDisplayValue(rawV);
        if (!rawV) return { text: label };
        return { text: `${label}：${rawV}` };
      }
      return { text: "" };
    })
    .filter((item) => Boolean(item.text));
}

function findInfoboxValue(
  infobox: BangumiInfoboxItem[] | null | undefined,
  keys: readonly string[],
): string {
  if (!infobox?.length) return "";

  for (const key of keys) {
    for (const item of infobox) {
      if (item.key !== key) continue;
      const values = formatInfoboxDisplayValues(item.value, item.key);
      const text = values
        .map((value) => value.text.trim())
        .filter(Boolean)
        .join("、");
      if (text) return text;
    }
  }
  return "";
}

function hasReleaseDate(infobox: BangumiInfoboxItem[]): boolean {
  const wanted = new Set<string>(RELEASE_DATE_KEYS);
  return infobox.some((item) => {
    if (!wanted.has(item.key)) return false;
    return formatInfoboxDisplayValues(item.value, item.key).length > 0;
  });
}

export function getSubjectCreditInfo(
  infobox: BangumiInfoboxItem[] | null | undefined,
): { developer: string; scenario: string } {
  return {
    developer: findInfoboxValue(infobox, DEVELOPER_KEYS),
    scenario: findInfoboxValue(infobox, SCENARIO_KEYS),
  };
}

export function getGameStudioName(
  infobox: BangumiInfoboxItem[] | null | undefined,
): string {
  return findInfoboxValue(infobox, STUDIO_KEYS);
}

export function formatSubjectCreditLine(
  infobox: BangumiInfoboxItem[] | null | undefined,
): string {
  const { developer, scenario } = getSubjectCreditInfo(infobox);
  const parts: string[] = [];
  if (developer) parts.push(`开发：${developer}`);
  if (scenario) parts.push(`剧本：${scenario}`);
  return parts.join("\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0");
}

export function buildInfoboxRows(
  infobox: BangumiInfoboxItem[] | null | undefined,
): InfoboxDisplayRow[] {
  const source = Array.isArray(infobox) ? infobox : [];
  const rows: InfoboxDisplayRow[] = [];

  for (const item of source) {
    const values = formatInfoboxDisplayValues(item.value, item.key);
    if (!values.length) continue;
    rows.push({ key: item.key, values });
  }

  return rows;
}

export function buildGameInfoboxRows(
  infobox: BangumiInfoboxItem[] | null | undefined,
  fallbackDate?: string | null,
): InfoboxDisplayRow[] {
  const source = Array.isArray(infobox) ? infobox : [];
  const rows = buildInfoboxRows(source);

  const date = fallbackDate?.trim() ?? "";
  if (date && !hasReleaseDate(source)) {
    rows.unshift({ key: "发售日", values: [{ text: date }] });
  }

  return rows;
}
