import { convertFileSrc } from "@tauri-apps/api/core";
import type { LibraryGame } from "./types";

type CoverLike = {
  coverPath?: string | null;
  image?: string | null;
  images?: {
    large?: string | null;
    medium?: string | null;
    small?: string | null;
    common?: string | null;
  } | null;
};

function remoteCoverUrl(game: CoverLike): string | null {
  const images = game.images;
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
): string | null {
  const local = game.coverPath?.trim();
  if (local) return convertFileSrc(local);
  return remoteCoverUrl(game);
}
