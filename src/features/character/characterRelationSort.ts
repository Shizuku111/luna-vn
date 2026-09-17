const CHARACTER_RELATION_RANK: Record<string, number> = {
  主角: 0,
  配角: 1,
  客串: 2,
  闲角: 3,
};

export function characterRelationRank(relation?: string | null) {
  const key = relation?.trim() ?? "";
  if (!key) return 950;
  return CHARACTER_RELATION_RANK[key] ?? 800;
}

export function compareCharacterRelationLabels(a: string, b: string) {
  const rank = characterRelationRank(a) - characterRelationRank(b);
  if (rank !== 0) return rank;
  return a.localeCompare(b, "zh");
}
