import { DialogConfirm } from "@/components/Dialog";
import {
  deleteLibraryGame,
  launchLibraryGame as invokeLaunchLibraryGame,
  LibraryGameStatus,
  revealLibraryGame,
  updateLibraryGame,
  updateLibraryGameFavorite,
  updateLibraryGameWishlist,
  updateLibraryGameStatus,
  type LibraryGame,
  type LibraryGameStatusValue,
} from "@/features/library";
import { getLEPath, ensureLEPathConfigured } from "@/features/settings";
import { toErrorMessage } from "@/utils/errorMessage";
import { PickLaunchExeDialog } from "./components/PickLaunchExeDialog";

export type LaunchGameResult = {
  statusChanged: boolean;
  game: LibraryGame;
  launched: boolean;
};

function isMissingLaunchExeError(err: unknown) {
  return toErrorMessage(err, "").includes("启动程序不存在");
}

async function saveLaunchPath(
  game: LibraryGame,
  launchPath: string,
): Promise<LibraryGame> {
  return updateLibraryGame({
    id: game.id,
    bangumiId: game.bangumiId,
    name: game.name,
    nameCn: game.nameCn,
    launchPath,
  });
}

async function offerRelocateLaunchExe(
  game: LibraryGame,
): Promise<LibraryGame | null> {
  const shouldPick = await DialogConfirm({
    title: "启动程序不存在",
    content: "未找到当前游戏的启动程序，是否立即选择？",
    confirmText: "立即选择",
  });
  if (!shouldPick) return null;

  const selected = await PickLaunchExeDialog({
    initialPath: game.launchPath?.trim() || "",
  });
  if (!selected) return null;

  return saveLaunchPath(game, selected);
}

async function launchPreparedGame(
  game: LibraryGame,
): Promise<LaunchGameResult> {
  let lePath: string | null = null;

  if (game.regionLaunch) {
    const ready = await ensureLEPathConfigured();
    if (!ready) {
      throw new Error("转区启动已开启，请先配置 Locale Emulator");
    }
    const configured = (await getLEPath()).trim();
    if (!configured) {
      throw new Error("转区启动已开启，请先配置 Locale Emulator");
    }
    lePath = configured;
  }

  let updated = await invokeLaunchLibraryGame(game.id, { lePath });

  if (game.status === LibraryGameStatus.NotStarted) {
    updated = await updateLibraryGameStatus(
      game.id,
      LibraryGameStatus.Playing,
    );
    return { statusChanged: true, game: updated, launched: true };
  }

  return { statusChanged: false, game: updated, launched: true };
}

export async function launchGame(game: LibraryGame): Promise<LaunchGameResult> {
  try {
    return await launchPreparedGame(game);
  } catch (err) {
    if (!isMissingLaunchExeError(err)) throw err;

    const relocated = await offerRelocateLaunchExe(game);
    if (!relocated) {
      return { statusChanged: false, game, launched: false };
    }

    return launchPreparedGame(relocated);
  }
}

export async function openGameFolder(game: LibraryGame): Promise<void> {
  await revealLibraryGame(game.launchPath);
}

export async function deleteGame(game: LibraryGame): Promise<void> {
  await deleteLibraryGame(game.id);
}

export async function markGameStatus(
  game: LibraryGame,
  status: LibraryGameStatusValue,
): Promise<LibraryGame> {
  return updateLibraryGameStatus(game.id, status);
}

export async function markGameFavorite(
  game: LibraryGame,
  favorite: boolean,
): Promise<LibraryGame> {
  return updateLibraryGameFavorite(game.id, favorite);
}

export async function markGameWishlist(
  game: LibraryGame,
  wishlist: boolean,
): Promise<LibraryGame> {
  return updateLibraryGameWishlist(game.id, wishlist);
}
