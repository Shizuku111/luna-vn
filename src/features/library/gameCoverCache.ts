import { getLibraryGame } from "./libraryStore";

export type CachedGameCover = {
  coverPath?: string | null;
};

const cache = new Map<number, CachedGameCover>();
const inflight = new Map<number, Promise<CachedGameCover | null>>();
const listeners = new Set<() => void>();

export function peekGameCoverCache(id: number): CachedGameCover | undefined {
  return cache.get(id);
}

export function subscribeGameCoverCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function rememberGameCover(id: number, cover: CachedGameCover) {
  const coverPath =
    cover.coverPath === undefined
      ? (cache.get(id)?.coverPath ?? null)
      : cover.coverPath?.trim() || null;
  if (!coverPath) {
    if (!cache.has(id)) return;
    cache.delete(id);
    for (const listener of listeners) listener();
    return;
  }
  if (cache.get(id)?.coverPath === coverPath) {
    return;
  }
  cache.set(id, { coverPath });
  for (const listener of listeners) listener();
}

export function clearGameCoverCache() {
  cache.clear();
  inflight.clear();
}

export function mergeCachedGameCover<T extends CachedGameCover & { id: number }>(
  game: T,
): T {
  const cached = cache.get(game.id);
  if (!cached) return game;
  return {
    ...game,
    coverPath: cached.coverPath ?? game.coverPath,
  };
}

export function loadLocalGameCover(
  id: number,
): Promise<CachedGameCover | null> {
  const cached = cache.get(id);
  if (cached?.coverPath) {
    return Promise.resolve(cached);
  }
  const pending = inflight.get(id);
  if (pending) return pending;

  const request = getLibraryGame(id)
    .then((game) => {
      const coverPath = game.coverPath?.trim() || null;
      if (coverPath) {
        rememberGameCover(id, { coverPath });
        return { coverPath };
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(id);
    });

  inflight.set(id, request);
  return request;
}
