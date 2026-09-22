import { useEffect, useRef, useState } from "react";
import {
  loadLocalGameCover,
  mergeCachedGameCover,
  subscribeGameCoverCache,
  type LibraryGame,
  resolveGameCoverUrl,
} from "@/features/library";

export function useGameCoverUrl(game: LibraryGame) {
  const gameRef = useRef(game);
  gameRef.current = game;
  const [url, setUrl] = useState(() =>
    resolveGameCoverUrl(mergeCachedGameCover(game)),
  );

  useEffect(() => {
    const apply = () => {
      const next = resolveGameCoverUrl(mergeCachedGameCover(gameRef.current));
      setUrl((prev) => (prev === next ? prev : next));
    };
    apply();
    const unsubscribe = subscribeGameCoverCache(apply);

    const merged = mergeCachedGameCover(gameRef.current);
    if (merged.coverPath?.trim()) {
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
  }, [game.id]);

  return url;
}
