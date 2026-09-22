import { useEffect, useRef } from "react";
import {
  ensureLibraryGameListCover,
  peekGameCoverCache,
  rememberGameCover,
  type LibraryGame,
} from "@/features/library";

const DEFAULT_CONCURRENCY = 2;

function needsCover(game: LibraryGame) {
  if (game.coverThumbPath?.trim()) return false;
  const cached = peekGameCoverCache(game.id);
  return !cached?.coverThumbPath;
}

export function useHydrateGameCovers(
  games: LibraryGame[],
  options?: { concurrency?: number; resetKey?: number | string },
) {
  const gamesRef = useRef(games);
  gamesRef.current = games;
  const inFlightRef = useRef(new Set<number>());
  const doneRef = useRef(new Set<number>());
  const activeRef = useRef(0);
  const generationRef = useRef(0);
  const pumpRef = useRef<() => void>(() => {});
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const resetKey = options?.resetKey;

  useEffect(() => {
    generationRef.current += 1;
    doneRef.current.clear();
    inFlightRef.current.clear();
    activeRef.current = 0;
  }, [resetKey]);

  useEffect(() => {
    const alive = new Set(games.map((game) => game.id));
    for (const id of [...doneRef.current]) {
      if (!alive.has(id)) doneRef.current.delete(id);
    }
  }, [games]);

  useEffect(() => {
    let cancelled = false;
    const generation = generationRef.current;

    const pump = () => {
      if (cancelled || generation !== generationRef.current) return;
      const targets = gamesRef.current;
      while (activeRef.current < concurrency) {
        const next = targets.find(
          (game) =>
            needsCover(game) &&
            !inFlightRef.current.has(game.id) &&
            !doneRef.current.has(game.id),
        );
        if (!next) break;
        inFlightRef.current.add(next.id);
        activeRef.current += 1;
        const started = next;
        void ensureLibraryGameListCover(started.id)
          .then((updated) => {
            if (cancelled || generation !== generationRef.current) return;
            doneRef.current.add(started.id);
            if (updated.coverThumbPath?.trim()) {
              rememberGameCover(started.id, {
                coverThumbPath: updated.coverThumbPath,
              });
            }
          })
          .catch(() => {
            if (cancelled || generation !== generationRef.current) return;
            doneRef.current.add(started.id);
          })
          .finally(() => {
            if (cancelled || generation !== generationRef.current) return;
            inFlightRef.current.delete(started.id);
            activeRef.current -= 1;
            pump();
          });
      }
    };

    pumpRef.current = pump;
    pump();

    return () => {
      cancelled = true;
      pumpRef.current = () => {};
    };
  }, [concurrency, resetKey]);

  useEffect(() => {
    pumpRef.current();
  }, [games]);
}
