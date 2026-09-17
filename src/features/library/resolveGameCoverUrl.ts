import { convertFileSrc } from "@tauri-apps/api/core";
import type { LibraryGame } from "./types";

export type GameCoverVariant = "list" | "detail" | "thumb";

type CoverLike = {
  coverPath?: string | null;
  coverThumbPath?: string | null;
  image?: string | null;
  images?: {
    large?: string | null;
    medium?: string | null;
    small?: string | null;
    common?: string | null;
  } | null;
};

function remoteCoverUrl(game: CoverLike, variant: GameCoverVariant): string | null {
  const images = game.images;
  if (variant === "thumb") {
    return (
      images?.small ||
      images?.medium ||
      images?.common ||
      images?.large ||
      game.image ||
      null
    );
  }
  if (variant === "list") {
    return (
      images?.medium ||
      images?.common ||
      images?.large ||
      images?.small ||
      game.image ||
      null
    );
  }
  return (
    images?.large ||
    game.image ||
    images?.common ||
    images?.medium ||
    images?.small ||
    null
  );
}

export function resolveGameCoverUrl(
  game: CoverLike | LibraryGame,
  variant: GameCoverVariant = "detail",
): string | null {
  const local = game.coverPath?.trim();
  const thumb = game.coverThumbPath?.trim();

  if (variant === "thumb") {
    if (thumb) return convertFileSrc(thumb);
    if (local) return convertFileSrc(local);
    return remoteCoverUrl(game, variant);
  }

  if (local) return convertFileSrc(local);
  if (thumb) return convertFileSrc(thumb);
  return remoteCoverUrl(game, variant);
}
