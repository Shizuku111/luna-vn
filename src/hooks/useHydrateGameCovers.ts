import { useCallback, useEffect, useRef } from "react";
import { ensureLibraryGameCover, type LibraryGame } from "@/features/library";

const DEFAULT_CONCURRENCY = 2;

export function useHydrateGameCovers(
  games: LibraryGame[],
  onHydrated: (game: LibraryGame) => void,
  options?: { concurrency?: number; resetKey?: number | string },
) {
  const onHydratedRef = useRef(onHydrated);
  onHydratedRef.current = onHydrated;
  const inFlightRef = useRef(new Set<number>());
  const doneRef = useRef(new Set<number>());
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const resetKey = options?.resetKey;

  useEffect(() => {
    doneRef.current.clear();
    inFlightRef.current.clear();
  }, [resetKey]);

  useEffect(() => {
    const alive = new Set(games.map((game) => game.id));
    for (const id of [...doneRef.current]) {
      if (!alive.has(id)) doneRef.current.delete(id);
    }
    for (const id of [...inFlightRef.current]) {
      if (!alive.has(id)) inFlightRef.current.delete(id);
    }
  }, [games]);

  const ensureMissing = useCallback(
    (targets: LibraryGame[]) => {
      const missing = targets.filter(
        (game) =>
          !game.coverPath?.trim() &&
          !game.coverThumbPath?.trim() &&
          !inFlightRef.current.has(game.id) &&
          !doneRef.current.has(game.id),
      );
      if (missing.length === 0) return;

      let cancelled = false;
      let cursor = 0;
      let active = 0;

      const pump = () => {
        while (!cancelled && active < concurrency && cursor < missing.length) {
          const game = missing[cursor++];
          inFlightRef.current.add(game.id);
          active += 1;
          void ensureLibraryGameCover(game.id)
            .then((updated) => {
              doneRef.current.add(game.id);
              if (cancelled) return;
              if (
                updated.coverPath !== game.coverPath ||
                updated.coverThumbPath !== game.coverThumbPath
              ) {
                onHydratedRef.current(updated);
              }
            })
            .catch(() => {
              doneRef.current.add(game.id);
            })
            .finally(() => {
              inFlightRef.current.delete(game.id);
              active -= 1;
              pump();
            });
        }
      };

      pump();
      return () => {
        cancelled = true;
      };
    },
    [concurrency],
  );

  useEffect(() => {
    return ensureMissing(games);
  }, [games, ensureMissing]);
}
