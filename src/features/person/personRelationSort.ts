const PERSON_RELATION_RANK: Record<string, number> = {
  开发: 10,
  发行: 20,
  游戏设计师: 30,
  导演: 40,
  制作人: 50,
  制作总指挥: 60,
  监修: 70,
  配音导演: 80,
  剧本: 90,
  系列构成: 100,
  原作: 110,
  人物设定: 120,
  机械设定: 130,
  关卡设计: 140,
  UI: 150,
  作画监督: 160,
  原画: 170,
  美工: 180,
  "CG 监修": 190,
  SD原画: 200,
  背景: 210,
  海报: 220,
  动画制作: 230,
  动画监督: 240,
  动画剧本: 250,
  音响监督: 260,
  音乐: 270,
  主题歌作曲: 280,
  主题歌作词: 290,
  主题歌演出: 300,
  插入歌演出: 310,
  企画: 320,
  程序: 330,
  QC: 340,
  协力: 900,
};

export function parsePersonRelations(raw?: string | null): string[] {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
    if (typeof parsed === "string" && parsed.trim()) {
      return [parsed.trim()];
    }
  } catch {
    // fall through to delimiter / raw string parsing
  }
  if (/[、，,]/.test(trimmed)) {
    return trimmed
      .split(/[、，,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [trimmed];
}

export function personRelationRank(relation?: string | null) {
  const key = relation?.trim() ?? "";
  if (!key) return 950;
  return PERSON_RELATION_RANK[key] ?? 800;
}

export function primaryPersonRelation(raw?: string | null) {
  const relations = parsePersonRelations(raw);
  if (relations.length === 0) return "";
  return [...relations].sort(
    (a, b) => personRelationRank(a) - personRelationRank(b),
  )[0]!;
}

export function formatPersonRelations(raw?: string | null) {
  return parsePersonRelations(raw).join("、");
}

export function comparePersonRelationLabels(a: string, b: string) {
  const rank = personRelationRank(a) - personRelationRank(b);
  if (rank !== 0) return rank;
  return a.localeCompare(b, "zh");
}
