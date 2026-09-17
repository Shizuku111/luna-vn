import {
  BANGUMI_SUBJECT_TYPE_GAME,
  getSubjectSubjects,
} from "@/features/bangumi";
import {
  listAllLibraryGames,
  saveLibraryGameRelations,
} from "./libraryStore";
import type { LibraryGame, SaveGameRelationInput } from "./types";

type MatchedRelatedGame = Pick<LibraryGame, "id" | "bangumiId">;

async function syncLibraryGameRelationsOnce(
  gameId: number,
  bangumiId: number,
  games: LibraryGame[],
): Promise<MatchedRelatedGame[]> {
  if (!Number.isFinite(bangumiId) || bangumiId <= 0) {
    await saveLibraryGameRelations(gameId, []);
    return [];
  }

  const relatedSubjects = await getSubjectSubjects(bangumiId);
  const byBangumiId = new Map(
    games
      .filter((game) => game.bangumiId > 0)
      .map((game) => [game.bangumiId, game]),
  );

  const relations: SaveGameRelationInput[] = [];
  const matched: MatchedRelatedGame[] = [];
  for (const item of relatedSubjects) {
    if (item.type !== BANGUMI_SUBJECT_TYPE_GAME) continue;
    const related = byBangumiId.get(item.id);
    if (!related || related.id === gameId) continue;
    relations.push({
      relatedGameId: related.id,
      relation: item.relation?.trim() || "",
      sortOrder: relations.length,
    });
    matched.push({ id: related.id, bangumiId: related.bangumiId });
  }

  await saveLibraryGameRelations(gameId, relations);
  return matched;
}

export async function syncLibraryGameRelations(
  gameId: number,
  bangumiId: number,
): Promise<void> {
  const games = await listAllLibraryGames();
  const matched = await syncLibraryGameRelationsOnce(gameId, bangumiId, games);
  if (matched.length === 0) return;

  const results = await Promise.allSettled(
    matched.map((related) =>
      syncLibraryGameRelationsOnce(related.id, related.bangumiId, games),
    ),
  );
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("部分关联游戏同步失败");
  }
}

export async function ensureLibraryGameRelations(
  gameId: number,
  bangumiId: number,
): Promise<boolean> {
  try {
    await syncLibraryGameRelations(gameId, bangumiId);
    return true;
  } catch {
    return false;
  }
}
