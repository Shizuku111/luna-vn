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

  const upsertGame = useCallback((updated: LibraryGame) => {
    setGames((list) => {
      const index = list.findIndex((item) => item.id === updated.id);
      if (index < 0) return [...list, updated];
      if (list[index] === updated) return list;
      const next = list.slice();
      next[index] = updated;
      return next;
    });
  }, []);

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
      removeGame,
    }),
    [games, loading, revision, refresh, upsertGame, removeGame],
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
