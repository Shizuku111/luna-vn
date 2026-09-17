import type { BangumiSearchSubject } from "./types";

const LONG_NAME_RATIO = 2;

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_\-\u3000]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j]!;
    }
  }

  return prev[b.length]!;
}

export function nameSimilarity(left: string, right: string) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

export function isSubjectIdKeyword(keyword: string) {
  return /^\d+$/.test(keyword.trim());
}

function matchesSubjectName(
  keyword: string,
  name: string,
  minSimilarity: number,
) {
  const normalizedKeyword = normalizeName(keyword);
  const normalizedName = normalizeName(name);
  if (!normalizedKeyword || !normalizedName) return false;

  if (normalizedName.length >= normalizedKeyword.length * LONG_NAME_RATIO) {
    return normalizedName.includes(normalizedKeyword);
  }

  return nameSimilarity(keyword, name) >= minSimilarity;
}

export function filterSearchSubjects(
  keyword: string,
  subjects: BangumiSearchSubject[],
  minSimilarity = 0.5,
): BangumiSearchSubject[] {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  if (isSubjectIdKeyword(trimmed)) {
    const id = Number(trimmed);
    return subjects.filter((subject) => subject.id === id);
  }

  if (subjects.length <= 3) {
    return subjects;
  }

  return subjects.filter(
    (subject) =>
      matchesSubjectName(trimmed, subject.name ?? "", minSimilarity) ||
      matchesSubjectName(trimmed, subject.name_cn ?? "", minSimilarity),
  );
}
