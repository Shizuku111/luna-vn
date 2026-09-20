import { getLibraryGame } from "./libraryStore";

export type CachedGameCover = {
  coverPath?: string | null;
  coverThumbPath?: string | null;
};

const cache = new Map<number, CachedGameCover>();
const inflight = new Map<number, Promise<CachedGameCover | null>>();

export function peekGameCoverCache(id: number): CachedGameCover | undefined {
  return cache.get(id);
}

export function rememberGameCover(id: number, cover: CachedGameCover) {
  const coverPath = cover.coverPath?.trim() || null;
  const coverThumbPath = cover.coverThumbPath?.trim() || null;
  if (!coverPath && !coverThumbPath) {
    cache.delete(id);
    return;
  }
  cache.set(id, { coverPath, coverThumbPath });
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
    coverThumbPath: cached.coverThumbPath ?? game.coverThumbPath,
  };
}

export function loadLocalGameCover(
  id: number,
): Promise<CachedGameCover | null> {
  const cached = cache.get(id);
  if (cached?.coverPath || cached?.coverThumbPath) {
    return Promise.resolve(cached);
  }
  const pending = inflight.get(id);
  if (pending) return pending;

  const request = getLibraryGame(id)
    .then((game) => {
      const next: CachedGameCover = {
        coverPath: game.coverPath?.trim() || null,
        coverThumbPath: game.coverThumbPath?.trim() || null,
      };
      if (next.coverPath || next.coverThumbPath) {
        rememberGameCover(id, next);
        return next;
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
