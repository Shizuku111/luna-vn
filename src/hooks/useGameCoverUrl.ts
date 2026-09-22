import { useEffect, useRef, useState } from "react";
import {
  loadLocalGameCover,
  mergeCachedGameCover,
  subscribeGameCoverCache,
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
    const apply = () => {
      const next = resolveGameCoverUrl(
        mergeCachedGameCover(gameRef.current),
        variant,
      );
      setUrl((prev) => (prev === next ? prev : next));
    };
    apply();
    const unsubscribe = subscribeGameCoverCache(apply);
    if (variant === "list") {
      return unsubscribe;
    }

    const merged = mergeCachedGameCover(gameRef.current);
    if (merged.coverPath?.trim() || merged.coverThumbPath?.trim()) {
      return unsubscribe;
    }

    let cancelled = false;
    void loadLocalGameCover(gameRef.current.id).then((found) => {
      if (cancelled || !found) return;
      apply();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [game.id, variant]);

  return url;
}
