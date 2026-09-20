import { useEffect, useRef, useState } from "react";
import {
  loadLocalGameCover,
  mergeCachedGameCover,
  type LibraryGame,
  resolveGameCoverUrl,
  type GameCoverVariant,
} from "@/features/library";

export function useGameCoverUrl(
  game: LibraryGame,
  variant: GameCoverVariant = "detail",
) {
  const gameRef = useRef(game);
  gameRef.current = game;
  const [url, setUrl] = useState(() =>
    resolveGameCoverUrl(mergeCachedGameCover(game), variant),
  );

  useEffect(() => {
    const current = gameRef.current;
    const merged = mergeCachedGameCover(current);
    setUrl(resolveGameCoverUrl(merged, variant));
    if (merged.coverPath?.trim() || merged.coverThumbPath?.trim()) {
      return;
    }

    let cancelled = false;
    void loadLocalGameCover(current.id).then((found) => {
      if (cancelled || !found) return;
      setUrl(resolveGameCoverUrl({ ...current, ...found }, variant));
    });
    return () => {
      cancelled = true;
    };
  }, [game.id, variant]);

  return url;
}
