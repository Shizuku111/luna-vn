import { invoke } from "@tauri-apps/api/core";
import {
  getSubjectById,
  type BangumiSearchSubject,
} from "@/features/bangumi";
import { getShowNsfw } from "@/features/settings";
import type {
  GameLogItem,
  LibraryGame,
  LibraryGameRelation,
  LibraryGameStatusValue,
  SavedLibraryGame,
  SaveGameRelationInput,
  SaveLibraryGameInput,
  SaveManualLibraryGameInput,
  UpdateLibraryGameInput,
  UpdateLibraryGameSubject,
} from "./types";

function resolveImage(subject: BangumiSearchSubject) {
  return (
    subject.image ||
    subject.images?.large ||
    subject.images?.medium ||
    subject.images?.small ||
    null
  );
}

export function toUpdateLibraryGameSubject(
  subject: BangumiSearchSubject,
): UpdateLibraryGameSubject {
  return {
    type: subject.type,
    summary: subject.summary ?? null,
    date: subject.date ?? null,
    image: resolveImage(subject),
    images: subject.images ?? null,
    score: subject.score ?? null,
    rank: subject.rank ?? null,
    tags: (subject.tags ?? [])
      .map((tag) => tag.name.trim())
      .filter(Boolean),
    nsfw: subject.nsfw ?? false,
    infobox: subject.infobox ?? null,
  };
}

export function toSaveLibraryGameInput(
  subject: BangumiSearchSubject,
  launchPath: string,
): SaveLibraryGameInput {
  return {
    bangumiId: subject.id,
    type: subject.type,
    name: subject.name,
    nameCn: subject.name_cn,
    summary: subject.summary ?? null,
    date: subject.date ?? null,
    image: resolveImage(subject),
    images: subject.images ?? null,
    score: subject.score ?? null,
    rank: subject.rank ?? null,
    tags: (subject.tags ?? [])
      .map((tag) => tag.name.trim())
      .filter(Boolean),
    nsfw: subject.nsfw ?? false,
    infobox: subject.infobox ?? null,
    launchPath,
  };
}

export async function saveLibraryGame(
  input: SaveLibraryGameInput,
): Promise<SavedLibraryGame> {
  return invoke<SavedLibraryGame>("save_library_game", { game: input });
}

export async function saveManualLibraryGame(
  input: SaveManualLibraryGameInput,
): Promise<SavedLibraryGame> {
  return invoke<SavedLibraryGame>("save_manual_library_game", { game: input });
}

export type BatchImportScanItem = {
  folderName: string;
  folderPath: string;
  exePaths: string[];
};

export async function scanBatchImportRoot(
  rootPath: string,
): Promise<BatchImportScanItem[]> {
  return invoke<BatchImportScanItem[]>("scan_batch_import_root", {
    rootPath,
  });
}

export async function cancelBatchImportScan(): Promise<void> {
  await invoke("cancel_batch_import_scan");
}

export async function saveLibraryGameFromSubject(
  subject: BangumiSearchSubject,
  launchPath: string,
): Promise<SavedLibraryGame> {
  return saveLibraryGame(toSaveLibraryGameInput(subject, launchPath));
}

export async function listLibraryGames(): Promise<LibraryGame[]> {
  const [games, showNsfw] = await Promise.all([
    listAllLibraryGames(),
    getShowNsfw(),
  ]);
  if (showNsfw) return games;
  return games.filter((game) => !game.nsfw);
}

export async function listAllLibraryGames(): Promise<LibraryGame[]> {
  return invoke<LibraryGame[]>("list_library_games");
}

export async function listLibraryGamesBasic(): Promise<LibraryGame[]> {
  const [games, showNsfw] = await Promise.all([
    invoke<LibraryGame[]>("list_library_games_basic"),
    getShowNsfw(),
  ]);
  if (showNsfw) return games;
  return games.filter((game) => !game.nsfw);
}

export async function listRecentGameLogs(limit = 40): Promise<GameLogItem[]> {
  const [logs, showNsfw] = await Promise.all([
    invoke<GameLogItem[]>("list_recent_game_logs", { limit }),
    getShowNsfw(),
  ]);
  if (showNsfw) return logs;
  return logs.filter((log) => !log.nsfw);
}

export async function listLibraryGameLogs(
  gameId: number,
  limit = 100,
): Promise<GameLogItem[]> {
  return invoke<GameLogItem[]>("list_library_game_logs", {
    gameId,
    limit,
  });
}

export async function getLibraryGame(id: number): Promise<LibraryGame> {
  return invoke<LibraryGame>("get_library_game", { id });
}

export async function ensureLibraryGameCover(id: number): Promise<LibraryGame> {
  return invoke<LibraryGame>("ensure_library_game_cover", { id });
}

export async function ensureLibraryGameListCover(
  id: number,
): Promise<{ coverThumbPath?: string | null }> {
  return invoke("ensure_library_game_list_cover", { id });
}

export async function launchLibraryGame(
  id: number,
  options?: { lePath?: string | null },
): Promise<LibraryGame> {
  return invoke<LibraryGame>("launch_library_game", {
    id,
    lePath: options?.lePath?.trim() || null,
  });
}

export async function revealLibraryGame(path: string): Promise<void> {
  await invoke("reveal_library_game", { path });
}

export async function updateLibraryGame(
  input: UpdateLibraryGameInput,
): Promise<LibraryGame> {
  return invoke<LibraryGame>("update_library_game", { game: input });
}

export async function updateLibraryGameFromBangumi(
  game: LibraryGame,
): Promise<LibraryGame> {
  const subject = await getSubjectById(game.bangumiId);
  const name = subject.name?.trim() || subject.name_cn?.trim() || game.name;
  const nameCn = subject.name_cn?.trim() ?? "";
  return updateLibraryGame({
    id: game.id,
    bangumiId: game.bangumiId,
    name,
    nameCn,
    launchPath: game.launchPath,
    subject: toUpdateLibraryGameSubject(subject),
    updateCover: true,
  });
}

export async function updateLibraryGameStatus(
  id: number,
  status: LibraryGameStatusValue,
): Promise<LibraryGame> {
  return invoke<LibraryGame>("update_library_game_status", { id, status });
}

export async function updateLibraryGameRegionLaunch(
  id: number,
  regionLaunch: boolean,
): Promise<LibraryGame> {
  return invoke<LibraryGame>("update_library_game_region_launch", {
    id,
    regionLaunch,
  });
}

export async function updateLibraryGameFavorite(
  id: number,
  favorite: boolean,
): Promise<LibraryGame> {
  return invoke<LibraryGame>("update_library_game_favorite", {
    id,
    favorite,
  });
}

export async function updateLibraryGameWishlist(
  id: number,
  wishlist: boolean,
): Promise<LibraryGame> {
  return invoke<LibraryGame>("update_library_game_wishlist", {
    id,
    wishlist,
  });
}

export async function archiveLibraryGame(
  id: number,
  tag?: string | null,
): Promise<LibraryGame> {
  return invoke<LibraryGame>("archive_library_game", {
    id,
    tag: tag?.trim() || null,
  });
}

export async function unarchiveLibraryGame(id: number): Promise<LibraryGame> {
  return invoke<LibraryGame>("unarchive_library_game", { id });
}

export async function listRecentArchiveTags(limit = 5): Promise<string[]> {
  return invoke<string[]>("list_recent_archive_tags", { limit });
}

export async function deleteLibraryGame(id: number): Promise<void> {
  await invoke("delete_library_game", { id });
}

export async function saveLibraryGameRelations(
  gameId: number,
  relations: SaveGameRelationInput[],
): Promise<void> {
  await invoke("save_library_game_relations", { gameId, relations });
}

export async function listLibraryGameRelations(
  gameId: number,
): Promise<LibraryGameRelation[]> {
  return invoke<LibraryGameRelation[]>("list_library_game_relations", {
    gameId,
  });
}
