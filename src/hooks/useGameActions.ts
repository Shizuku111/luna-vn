import { useCallback, useRef } from "react";
import { DialogConfirm } from "@/components/Dialog";
import { MessagePlugin } from "@/components/Message";
import {
  deleteGame,
  launchGame,
  markGameFavorite,
  markGameStatus,
  markGameWishlist,
  openGameFolder,
} from "@/features/game";
import {
  displayGameName,
  type LibraryGame,
  type LibraryGameStatusValue,
} from "@/features/library";
import { toErrorMessage } from "@/utils/errorMessage";

export type UseGameActionsOptions = {
  showOriginalName: boolean;
  onUpdated?: (game: LibraryGame) => void | Promise<void>;
  onDeleted?: (game: LibraryGame) => void | Promise<void>;
  onLaunched?: (game: LibraryGame) => void | Promise<void>;
};

export function useGameActions({
  showOriginalName,
  onUpdated,
  onDeleted,
  onLaunched,
}: UseGameActionsOptions) {
  const actionLockRef = useRef(false);

  const titleOf = useCallback(
    (game: LibraryGame) => displayGameName(game, showOriginalName),
    [showOriginalName],
  );

  const runLocked = useCallback((task: () => Promise<void>) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    void (async () => {
      try {
        await task();
      } finally {
        actionLockRef.current = false;
      }
    })();
  }, []);

  const handleLaunchGame = useCallback(
    (game: LibraryGame) => {
      runLocked(async () => {
        try {
          const result = await launchGame(game);
          if (!result.launched) return;
          await onUpdated?.(result.game);
          await onLaunched?.(result.game);
        } catch (err) {
          MessagePlugin.error(toErrorMessage(err, "启动失败"));
        }
      });
    },
    [onLaunched, onUpdated, runLocked],
  );

  const handleRevealGame = useCallback(
    (game: LibraryGame) => {
      runLocked(async () => {
        try {
          await openGameFolder(game);
        } catch (err) {
          MessagePlugin.error(toErrorMessage(err, "打开文件夹失败"));
        }
      });
    },
    [runLocked],
  );

  const handleStatusChange = useCallback(
    (game: LibraryGame, status: LibraryGameStatusValue) => {
      runLocked(async () => {
        try {
          const updated = await markGameStatus(game, status);
          await onUpdated?.(updated);
        } catch (err) {
          MessagePlugin.error(toErrorMessage(err, "更新状态失败"));
        }
      });
    },
    [onUpdated, runLocked],
  );

  const handleFavoriteChange = useCallback(
    (game: LibraryGame, favorite: boolean) => {
      void (async () => {
        if (!favorite) {
          const ok = await DialogConfirm({
            title: "取消喜欢",
            content: `确定取消「${titleOf(game)}」的喜欢吗？`,
            confirmText: "取消喜欢",
          });
          if (!ok) return;
        }

        runLocked(async () => {
          try {
            const updated = await markGameFavorite(game, favorite);
            await onUpdated?.(updated);
            MessagePlugin.success(favorite ? "已设为喜欢" : "已取消喜欢");
          } catch (err) {
            MessagePlugin.error(toErrorMessage(err, "更新喜欢失败"));
          }
        });
      })();
    },
    [onUpdated, runLocked, titleOf],
  );

  const handleWishlistChange = useCallback(
    (game: LibraryGame, wishlist: boolean) => {
      void (async () => {
        if (!wishlist) {
          const ok = await DialogConfirm({
            title: "取消想玩",
            content: `确定取消「${titleOf(game)}」的想玩吗？`,
            confirmText: "取消想玩",
          });
          if (!ok) return;
        }

        runLocked(async () => {
          try {
            const updated = await markGameWishlist(game, wishlist);
            await onUpdated?.(updated);
            MessagePlugin.success(wishlist ? "已设为想玩" : "已取消想玩");
          } catch (err) {
            MessagePlugin.error(toErrorMessage(err, "更新想玩失败"));
          }
        });
      })();
    },
    [onUpdated, runLocked, titleOf],
  );

  const handleDeleteGame = useCallback(
    (game: LibraryGame) => {
      void (async () => {
        const ok = await DialogConfirm({
          title: "删除游戏",
          content: `确定删除「${titleOf(game)}」吗？此操作不可恢复。`,
          confirmText: "删除",
          confirmTheme: "danger",
        });
        if (!ok) return;

        runLocked(async () => {
          try {
            await deleteGame(game);
            MessagePlugin.success("已删除游戏");
            await onDeleted?.(game);
          } catch (err) {
            MessagePlugin.error(toErrorMessage(err, "删除失败"));
          }
        });
      })();
    },
    [onDeleted, runLocked, titleOf],
  );

  return {
    handleLaunchGame,
    handleRevealGame,
    handleStatusChange,
    handleFavoriteChange,
    handleWishlistChange,
    handleDeleteGame,
  };
}
