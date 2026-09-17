import {
  asInfobox,
  formatInfoboxStringValue,
  isNameCnKey,
} from "@/features/bangumi";

export const ENTITY_LIST_SORT_OPTIONS = [
  { value: "added", label: "最近添加" },
  { value: "name", label: "名称" },
] as const;

export type EntityListSortValue =
  (typeof ENTITY_LIST_SORT_OPTIONS)[number]["value"];

type SearchableEntity = {
  name: string;
  infobox?: unknown;
};

type SortableEntity = {
  name: string;
  createdAt: string;
};

export function collectEntitySearchTexts(entity: SearchableEntity): string[] {
  const texts = [entity.name.trim()];
  const infobox = asInfobox(entity.infobox);
  if (!infobox) return texts.filter(Boolean);

  for (const item of infobox) {
    if (!isNameCnKey(item.key)) continue;
    const text = formatInfoboxStringValue(item.value);
    if (text) texts.push(text);
  }

  return texts.filter(Boolean);
}

export function matchesEntityQuery(
  entity: SearchableEntity,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return collectEntitySearchTexts(entity).some((text) =>
    text.toLowerCase().includes(normalized),
  );
}

export function compareEntitiesBySort(
  a: SortableEntity,
  b: SortableEntity,
  sortBy: EntityListSortValue,
  ascending: boolean,
): number {
  let result = 0;

  if (sortBy === "name") {
    result = a.name.localeCompare(b.name, "zh");
  } else {
    result = Number(a.createdAt) - Number(b.createdAt);
  }

  return ascending ? result : -result;
}

export function buildEntityListEmptyMessage(
  entityLabel: string,
  favoritesOnly: boolean,
  searchQuery: string,
  emptyFallback: string,
): string {
  const hasSearch = Boolean(searchQuery.trim());
  if (favoritesOnly) {
    return hasSearch
      ? `未找到匹配的喜欢${entityLabel}`
      : `暂无喜欢的${entityLabel}`;
  }
  return hasSearch ? `未找到匹配的${entityLabel}` : emptyFallback;
}
