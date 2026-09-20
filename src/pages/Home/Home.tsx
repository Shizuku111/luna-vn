import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@/components/Button";
import type { DetailOpenOrigin } from "@/components/DetailOverlay";
import {
  ArchiveIcon,
  BookmarkIcon,
  CalendarIcon,
  HeartBrokenIcon,
  HeartIcon,
  HistoryIcon,
  PlayIcon,
  PlusIcon,
} from "@/components/icons";
import { MessagePlugin } from "@/components/Message";
import { Tooltip } from "@/components/Tooltip";
import { getGameStudioName, asInfobox } from "@/features/bangumi";
import { toErrorMessage } from "@/utils/errorMessage";
import { useRefreshSeq } from "@/hooks/useRefreshSeq";
import { useGameActions } from "@/hooks/useGameActions";
import { useHydrateGameCovers } from "@/hooks/useHydrateGameCovers";
import {
  GAME_LOGS_CHANGED_EVENT,
  GAME_LOG_ACTION_LABEL,
  GAME_LOG_STATUS_ACTION_ICON,
  listRecentGameLogs,
  formatGameLogFullTime,
  formatGameLogListTime,
  resolveGameListNames,
  resolveGameLogActionTone,
  useLibraryGames,
  type GameLogItem,
  type LibraryGame,
} from "@/features/library";
import { useShowOriginalName } from "@/features/settings";
import { LibraryGameCard } from "@/pages/Library/components/LibraryGameCard";
import { HomeFeaturedCard } from "./HomeFeaturedCard";
import "./Home.css";

const EditGameDialog = lazy(() =>
  import("@/features/library/components/EditGameDialog").then((m) => ({
    default: m.EditGameDialog,
  })),
);

type HomePageProps = {
  onOpenGame?: (gameId: number, origin?: DetailOpenOrigin | null) => void;
  onAddGame?: () => void;
};

const ACTION_ICON: Record<string, ReactNode> = {
  import: <PlusIcon aria-hidden />,
  open: <PlayIcon aria-hidden />,
  favorite: (
    <HeartIcon aria-hidden className="library-favorite-icon is-favorite" />
  ),
  unfavorite: <HeartBrokenIcon aria-hidden />,
  wishlist: (
    <BookmarkIcon aria-hidden className="library-wishlist-icon is-wishlist" />
  ),
  unwishlist: <BookmarkIcon aria-hidden />,
  archive: <ArchiveIcon aria-hidden />,
  unarchive: <ArchiveIcon aria-hidden />,
  ...GAME_LOG_STATUS_ACTION_ICON,
};

function resolveLogCoverUrl(log: GameLogItem): string | null {
  const thumb = log.coverThumbPath?.trim();
  if (thumb) return convertFileSrc(thumb);
  const local = log.coverPath?.trim();
  if (local) return convertFileSrc(local);
  return log.image?.trim() || null;
}

type FeaturedSource = "open" | "import";

type FeaturedPick = {
  game: LibraryGame;
  source: FeaturedSource;
  at?: string;
};

function pickFeaturedGame(
  logs: GameLogItem[],
  games: LibraryGame[],
): FeaturedPick | null {
  if (!games.length) return null;
  const byId = new Map(games.map((game) => [game.id, game]));

  for (const log of logs) {
    if (log.action !== "open") continue;
    const game = byId.get(log.gameId);
    if (game) return { game, source: "open", at: log.createdAt };
  }

  for (const log of logs) {
    if (log.action !== "import") continue;
    const game = byId.get(log.gameId);
    if (game) return { game, source: "import", at: log.createdAt };
  }

  let latest: LibraryGame | null = null;
  for (const game of games) {
    if (!latest || Number(game.createdAt) > Number(latest.createdAt)) {
      latest = game;
    }
  }
  return latest
    ? { game: latest, source: "import", at: latest.createdAt }
    : null;
}

function pickRecentOpenOrImportGames(
  logs: GameLogItem[],
  games: LibraryGame[],
  limit: number,
): LibraryGame[] {
  if (!games.length || limit <= 0) return [];
  const byId = new Map(games.map((game) => [game.id, game]));
  const result: LibraryGame[] = [];
  const seen = new Set<number>();

  for (const log of logs) {
    if (log.action !== "open" && log.action !== "import") continue;
    if (seen.has(log.gameId)) continue;
    const game = byId.get(log.gameId);
    if (!game) continue;
    seen.add(log.gameId);
    result.push(game);
    if (result.length >= limit) break;
  }

  return result;
}

function pickSecondaryGames(
  recent: LibraryGame[],
  featured: LibraryGame | null,
): LibraryGame[] {
  if (!recent.length) return [];
  const featuredId = featured?.id;
  const hasFeatured =
    featuredId != null && recent.some((game) => game.id === featuredId);

  if (hasFeatured) {
    return recent.filter((game) => game.id !== featuredId).slice(0, 6);
  }

  return recent.slice(0, 6);
}

export function HomePage({
  onOpenGame,
  onAddGame,
}: HomePageProps) {
  const showOriginalName = useShowOriginalName();
  const {
    games,
    loading: gamesLoading,
    upsertGame,
    removeGame,
    revision: gamesRevision,
  } = useLibraryGames();
  const [logs, setLogs] = useState<GameLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [editingGame, setEditingGame] = useState<LibraryGame | null>(null);
  const logsSeq = useRefreshSeq();
  const loading = gamesLoading || logsLoading;

  async function refreshLogs(showLoading: boolean) {
    const seq = logsSeq.begin();
    if (showLoading) setLogsLoading(true);
    try {
      const nextLogs = await listRecentGameLogs(100);
      if (!logsSeq.isCurrent(seq)) return;
      setLogs(nextLogs);
    } catch (err) {
      if (!logsSeq.isCurrent(seq)) return;
      if (showLoading) {
        MessagePlugin.error(toErrorMessage(err, "加载游戏日志失败"));
        setLogs([]);
      }
    } finally {
      if (logsSeq.isCurrent(seq)) setLogsLoading(false);
    }
  }

  const onRefreshLogs = useEffectEvent((showLoading: boolean) => {
    void refreshLogs(showLoading);
  });

  useEffect(() => {
    onRefreshLogs(true);
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen(GAME_LOGS_CHANGED_EVENT, () => {
      onRefreshLogs(false);
    }).then((fn) => {
      if (disposed) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const featured = useMemo(() => pickFeaturedGame(logs, games), [logs, games]);
  const featuredGame = featured?.game ?? null;
  const secondaryGames = useMemo(() => {
    const recent = pickRecentOpenOrImportGames(logs, games, 7);
    return pickSecondaryGames(recent, featuredGame);
  }, [logs, games, featuredGame]);

  const hydrateTargets = useMemo(() => {
    const ids = new Set<number>();
    const list: LibraryGame[] = [];
    if (featuredGame) {
      ids.add(featuredGame.id);
      list.push(featuredGame);
    }
    for (const game of secondaryGames) {
      if (ids.has(game.id)) continue;
      ids.add(game.id);
      list.push(game);
    }
    return list;
  }, [featuredGame, secondaryGames]);

  useHydrateGameCovers(hydrateTargets, {
    resetKey: gamesRevision,
  });

  const {
    handleLaunchGame,
    handleRevealGame,
    handleStatusChange,
    handleFavoriteChange,
    handleWishlistChange,
    handleArchiveChange,
    handleDeleteGame,
  } = useGameActions({
    showOriginalName,
    onUpdated: upsertGame,
    onLaunched: () => void refreshLogs(false),
    onDeleted: (game) => {
      removeGame(game.id);
      setLogs((list) => list.filter((item) => item.gameId !== game.id));
    },
  });

  function handleOpenGameCard(game: LibraryGame, origin?: DOMRect) {
    onOpenGame?.(game.id, origin ?? null);
  }

  function handleCloseEdit() {
    setEditingGame(null);
  }

  function handleEditSaved(updated: LibraryGame) {
    upsertGame(updated);
    setEditingGame(null);
  }

  return (
    <section className="home-page">
      {!loading && games.length === 0 ? (
        <div className="home-empty">
          <p className="home-empty-text">暂无游戏</p>
          <Button
            theme="primary"
            prefix={<PlusIcon aria-hidden />}
            content="添加游戏"
            onClick={() => onAddGame?.()}
          />
        </div>
      ) : (
        <>
          <div className="home-main">
            <div className="home-slot home-slot-top">
              {featured ? (
                <HomeFeaturedCard
                  key={featured.game.id}
                  game={featured.game}
                  source={featured.source}
                  sourceAt={featured.at}
                  showOriginalName={showOriginalName}
                  onOpen={handleOpenGameCard}
                  onLaunch={handleLaunchGame}
                />
              ) : (
                <div className="home-placeholder" aria-hidden>
                  <span className="home-placeholder-label">暂无游戏</span>
                </div>
              )}
            </div>
            <div className="home-slot home-slot-bottom">
              <div className="home-secondary-panel">
                <header className="home-secondary-header">
                  <h2 className="home-secondary-title">最近</h2>
                  <HistoryIcon className="home-panel-icon" aria-hidden />
                </header>
                {secondaryGames.length > 0 ? (
                  <ul className="home-secondary-list">
                    {secondaryGames.map((game) => (
                      <LibraryGameCard
                        key={game.id}
                        game={game}
                        showOriginalName={showOriginalName}
                        onOpen={handleOpenGameCard}
                        onEdit={setEditingGame}
                        onLaunch={handleLaunchGame}
                        onReveal={handleRevealGame}
                        onDelete={handleDeleteGame}
                        onStatusChange={handleStatusChange}
                        onFavoriteChange={handleFavoriteChange}
                        onWishlistChange={handleWishlistChange}
                        onArchiveChange={handleArchiveChange}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="home-secondary-empty" aria-hidden>
                    <span className="home-placeholder-label">暂无更多游戏</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="home-aside">
            <header className="home-activity-header">
              <h2 className="home-activity-title">动态</h2>
              <CalendarIcon className="home-panel-icon" aria-hidden />
            </header>

            <div className="home-activity-body">
              {loading ? (
                <p className="home-activity-empty">加载中…</p>
              ) : logs.length === 0 ? (
                <p className="home-activity-empty">暂无动态</p>
              ) : (
                <ul className="home-activity-list">
                  {logs.map((log) => {
                    const { title, subtitle } = resolveGameListNames(
                      { name: log.name, nameCn: log.nameCn },
                      showOriginalName,
                    );
                    const studio = getGameStudioName(asInfobox(log.infobox));
                    const cover = resolveLogCoverUrl(log);
                    const actionText =
                      GAME_LOG_ACTION_LABEL[log.action] ?? log.action;
                    const actionIcon = ACTION_ICON[log.action] ?? (
                      <PlusIcon aria-hidden />
                    );
                    const actionTone = resolveGameLogActionTone(log.action);
                    return (
                      <li key={log.id}>
                        <button
                          type="button"
                          className="home-activity-item"
                          onClick={() => onOpenGame?.(log.gameId)}
                        >
                          <span className="home-activity-rail" aria-hidden>
                            <span
                              className={[
                                "home-activity-action-icon",
                                `is-${actionTone}`,
                              ].join(" ")}
                            >
                              {actionIcon}
                            </span>
                          </span>
                          <span
                            className={[
                              "home-activity-main",
                              `is-${actionTone}`,
                            ].join(" ")}
                          >
                            <span className="home-activity-cover">
                              {cover ? (
                                <img
                                  src={cover}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span
                                  className="home-activity-cover-empty"
                                  aria-hidden
                                />
                              )}
                            </span>
                            <span className="home-activity-meta">
                              <span
                                className={[
                                  "home-activity-action",
                                  `is-${actionTone}`,
                                ].join(" ")}
                              >
                                {actionText}
                              </span>
                              <span className="home-activity-name-container">
                                <span
                                  className="home-activity-name"
                                  title={title}
                                >
                                  {title}
                                </span>
                                {subtitle ? (
                                  <span
                                    className="home-activity-subtitle"
                                    title={subtitle}
                                  >
                                    {subtitle}
                                  </span>
                                ) : null}
                                {studio ? (
                                  <span
                                    className="home-activity-studio"
                                    title={studio}
                                  >
                                    {studio}
                                  </span>
                                ) : null}
                              </span>
                              <Tooltip
                                content={
                                  formatGameLogFullTime(log.createdAt) ||
                                  undefined
                                }
                              >
                                <span className="home-activity-time">
                                  {formatGameLogListTime(log.createdAt)}
                                </span>
                              </Tooltip>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}

      <Suspense fallback={<div className="app-page-fallback" aria-busy="true" />}>
        <EditGameDialog
          open={editingGame != null}
          game={editingGame}
          onClose={handleCloseEdit}
          onSaved={handleEditSaved}
        />
      </Suspense>
    </section>
  );
}
