import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { PlusIcon } from "@/components/icons";
import { DropDown } from "@/components/DropDown";
import { VirtualCardGrid } from "@/components/VirtualCardGrid";
import {
  displayGameName,
  useLibraryGames,
  type LibraryGame,
} from "@/features/library";
import { useShowOriginalName } from "@/features/settings";
import { offerBangumiTokenForImport } from "@/features/bangumi";
import { useGameActions } from "@/hooks/useGameActions";
import { useHydrateGameCovers } from "@/hooks/useHydrateGameCovers";
import { LibraryGameCard } from "./components/LibraryGameCard";
import {
  LibraryViewPanel,
  type SortValue,
  type StatusFilterValue,
} from "./components/LibraryViewPanel";
import "./Library.css";

const BatchImportDialog = lazy(() =>
  import("./components/BatchImportDialog").then((m) => ({
    default: m.BatchImportDialog,
  })),
);
const SingleImportDialog = lazy(() =>
  import("./components/SingleImportDialog").then((m) => ({
    default: m.SingleImportDialog,
  })),
);
const EditGameDialog = lazy(() =>
  import("@/features/library/components/EditGameDialog").then((m) => ({
    default: m.EditGameDialog,
  })),
);

const ADD_GAME_OPTIONS = [
  { value: "single", label: "单个导入" },
  { value: "batch", label: "批量导入" },
] as const;

type AddGameValue = (typeof ADD_GAME_OPTIONS)[number]["value"];

function compareGames(
  a: LibraryGame,
  b: LibraryGame,
  sortBy: SortValue,
  ascending: boolean,
  showOriginalName: boolean,
) {
  if (sortBy === "released") {
    const dateA = a.date?.trim() ?? "";
    const dateB = b.date?.trim() ?? "";
    const missingA = !dateA;
    const missingB = !dateB;
    if (missingA !== missingB) return missingA ? 1 : -1;
    if (missingA && missingB) return 0;
    const result = dateA.localeCompare(dateB);
    return ascending ? result : -result;
  }

  let result = 0;

  if (sortBy === "name") {
    result = displayGameName(a, showOriginalName).localeCompare(
      displayGameName(b, showOriginalName),
      "zh",
    );
  } else if (sortBy === "added") {
    result = Number(a.createdAt) - Number(b.createdAt);
  } else {
    result = Number(a.lastLaunchedAt ?? 0) - Number(b.lastLaunchedAt ?? 0);
  }

  return ascending ? result : -result;
}

export function LibraryPage({
  onOpenGame,
  onNavigateToSettings,
}: {
  onOpenGame?: (
    gameId: number,
    origin?: {
      left: number;
      top: number;
      width: number;
      height: number;
    } | null,
  ) => void;
  onNavigateToSettings?: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [sortBy, setSortBy] = useState<SortValue>("added");
  const [ascending, setAscending] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [wishlistFirst, setWishlistFirst] = useState(false);
  const [singleImportOpen, setSingleImportOpen] = useState(false);
  const [batchImportOpen, setBatchImportOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<LibraryGame | null>(null);
  const [viewportGames, setViewportGames] = useState<LibraryGame[]>([]);
  const showOriginalName = useShowOriginalName();
  const {
    games,
    loading,
    refresh: refreshGames,
    upsertGame,
    removeGame,
  } = useLibraryGames();

  useHydrateGameCovers(viewportGames, upsertGame);

  const visibleGames = useMemo(() => {
    const filtered =
      statusFilter === "all"
        ? games
        : games.filter((game) => game.status === Number(statusFilter));

    return [...filtered]
      .filter((game) => !favoritesOnly || game.favorite)
      .sort((a, b) => {
        if (wishlistFirst) {
          const wishlistRank = Number(b.wishlist) - Number(a.wishlist);
          if (wishlistRank !== 0) return wishlistRank;
        }
        return compareGames(a, b, sortBy, ascending, showOriginalName);
      });
  }, [
    games,
    statusFilter,
    sortBy,
    ascending,
    showOriginalName,
    favoritesOnly,
    wishlistFirst,
  ]);

  function handleAddSelect(value: AddGameValue) {
    void (async () => {
      const choice = await offerBangumiTokenForImport();
      if (choice === "settings") {
        onNavigateToSettings?.();
        return;
      }
      if (value === "single") {
        setSingleImportOpen(true);
        return;
      }
      setBatchImportOpen(true);
    })();
  }

  const viewIsFiltered =
    statusFilter !== "all" || wishlistFirst || favoritesOnly;

  const handleOpenGame = useCallback(
    (target: LibraryGame, origin?: DOMRect) => {
      onOpenGame?.(
        target.id,
        origin
          ? {
              left: origin.left,
              top: origin.top,
              width: origin.width,
              height: origin.height,
            }
          : null,
      );
    },
    [onOpenGame],
  );

  const handleEditGame = useCallback((target: LibraryGame) => {
    setEditingGame(target);
  }, []);

  const {
    handleLaunchGame,
    handleRevealGame,
    handleStatusChange,
    handleFavoriteChange,
    handleWishlistChange,
    handleDeleteGame,
  } = useGameActions({
    showOriginalName,
    onUpdated: upsertGame,
    onDeleted: (game) => {
      removeGame(game.id);
    },
    onLaunched: upsertGame,
  });

  function handleCloseSingleImport() {
    setSingleImportOpen(false);
  }

  function handleSingleImportSaved() {
    void refreshGames();
  }

  function handleCloseBatchImport() {
    setBatchImportOpen(false);
  }

  function handleCloseEdit() {
    setEditingGame(null);
  }

  function handleEditSaved(updated: LibraryGame) {
    upsertGame(updated);
  }

  const emptyMessage = favoritesOnly
    ? "暂无喜欢的游戏"
    : "你的视觉小说将出现在这里。";

  return (
    <section className="list-page">
      <header className="list-toolbar library-toolbar page-sticky-toolbar">
        <h1 className="library-toolbar-title" aria-live="polite">
          <span className="library-toolbar-title-name">游戏</span>
          {!loading ? (
            <>
              <span className="library-toolbar-title-sep" aria-hidden>
                ·
              </span>
              <span className="library-toolbar-title-count">
                {visibleGames.length}
              </span>
            </>
          ) : null}
        </h1>

        <div className="list-toolbar-right">
          <LibraryViewPanel
            statusFilter={statusFilter}
            sortBy={sortBy}
            ascending={ascending}
            favoritesOnly={favoritesOnly}
            wishlistFirst={wishlistFirst}
            active={viewIsFiltered}
            onStatusChange={setStatusFilter}
            onSortChange={setSortBy}
            onAscendingChange={setAscending}
            onFavoritesOnlyChange={setFavoritesOnly}
            onWishlistFirstChange={setWishlistFirst}
          />
          <DropDown
            className="library-toolbar-add"
            placement="bottom-end"
            options={[...ADD_GAME_OPTIONS]}
            onSelect={handleAddSelect}
            trigger={
              <button
                type="button"
                className="library-toolbar-trigger"
                aria-label="添加游戏"
              >
                <PlusIcon
                  className="library-toolbar-trigger-icon"
                  aria-hidden
                />
                <span className="library-toolbar-trigger-label">添加</span>
              </button>
            }
          />
        </div>
      </header>

      <div className="list-body">
        {loading ? (
          <p className="list-empty">加载中…</p>
        ) : visibleGames.length === 0 ? (
          <p className="list-empty">{emptyMessage}</p>
        ) : (
          <VirtualCardGrid
            className="list-grid"
            items={visibleGames}
            getItemKey={(game) => game.id}
            columns={5}
            columnGap={12}
            rowGap={24}
            overscan={2}
            measureRows={false}
            estimateRowHeight={(columnWidth) =>
              Math.ceil(columnWidth * 1.5 + 72)
            }
            resetScrollKey={`${statusFilter}\0${sortBy}\0${ascending}\0${showOriginalName}\0${favoritesOnly}\0${wishlistFirst}`}
            onVisibleItemsChange={setViewportGames}
            renderItem={(game) => (
              <LibraryGameCard
                game={game}
                showOriginalName={showOriginalName}
                onOpen={handleOpenGame}
                onEdit={handleEditGame}
                onLaunch={handleLaunchGame}
                onReveal={handleRevealGame}
                onStatusChange={handleStatusChange}
                onFavoriteChange={handleFavoriteChange}
                onWishlistChange={handleWishlistChange}
                onDelete={handleDeleteGame}
              />
            )}
          />
        )}
      </div>

      <Suspense fallback={<div className="app-page-fallback" aria-busy="true" />}>
        <SingleImportDialog
          open={singleImportOpen}
          onClose={handleCloseSingleImport}
          onSaved={handleSingleImportSaved}
        />
        <BatchImportDialog
          open={batchImportOpen}
          onClose={handleCloseBatchImport}
          onSaved={handleSingleImportSaved}
        />
        <EditGameDialog
          key={editingGame ? `edit-${editingGame.id}` : "edit-closed"}
          open={editingGame != null}
          game={editingGame}
          onClose={handleCloseEdit}
          onSaved={handleEditSaved}
        />
      </Suspense>
    </section>
  );
}
