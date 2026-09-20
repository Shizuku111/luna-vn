import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MessagePlugin } from "@/components/Message";
import { useRefreshSeq } from "@/hooks/useRefreshSeq";
import { toErrorMessage } from "@/utils/errorMessage";
import {
  LibraryGamesContext,
  type LibraryGamesControllerValue,
} from "./libraryGamesContext";
import { listLibraryGamesBasic } from "./libraryStore";
import type { LibraryGame } from "./types";

function applyGameUpdates(
  list: LibraryGame[],
  updates: LibraryGame[],
): LibraryGame[] {
  if (updates.length === 0) return list;

  if (updates.length === 1) {
    const updated = updates[0];
    const index = list.findIndex((item) => item.id === updated.id);
    if (index < 0) return [...list, updated];
    if (list[index] === updated) return list;
    const next = list.slice();
    next[index] = updated;
    return next;
  }

  const byId = new Map(updates.map((item) => [item.id, item]));
  const seen = new Set<number>();
  let changed = false;
  const next = list.map((item) => {
    const updated = byId.get(item.id);
    if (!updated) return item;
    seen.add(item.id);
    if (updated === item) return item;
    changed = true;
    return updated;
  });
  for (const updated of updates) {
    if (seen.has(updated.id)) continue;
    changed = true;
    next.push(updated);
  }
  return changed ? next : list;
}

function useLibraryGamesControllerState(): LibraryGamesControllerValue {
  const [games, setGames] = useState<LibraryGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refreshSeq = useRefreshSeq();

  const refresh = useCallback(async () => {
    const seq = refreshSeq.begin();
    try {
      const next = await listLibraryGamesBasic();
      if (!refreshSeq.isCurrent(seq)) return;
      setGames(next);
      setRevision((value) => value + 1);
    } catch (err) {
      if (!refreshSeq.isCurrent(seq)) return;
      MessagePlugin.error(toErrorMessage(err, "加载游戏库失败"));
    } finally {
      if (refreshSeq.isCurrent(seq)) setLoading(false);
    }
  }, [refreshSeq]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upsertGames = useCallback((updates: LibraryGame[]) => {
    if (updates.length === 0) return;
    setGames((list) => applyGameUpdates(list, updates));
  }, []);

  const upsertGame = useCallback(
    (updated: LibraryGame) => {
      upsertGames([updated]);
    },
    [upsertGames],
  );

  const removeGame = useCallback((id: number) => {
    setGames((list) => list.filter((item) => item.id !== id));
  }, []);

  return useMemo(
    () => ({
      games,
      loading,
      revision,
      refresh,
      upsertGame,
      upsertGames,
      removeGame,
    }),
    [games, loading, revision, refresh, upsertGame, upsertGames, removeGame],
  );
}

export function LibraryGamesProvider({ content }: { content: ReactNode }) {
  const value = useLibraryGamesControllerState();
  return (
    <LibraryGamesContext.Provider value={value}>
      {content}
    </LibraryGamesContext.Provider>
  );
}
