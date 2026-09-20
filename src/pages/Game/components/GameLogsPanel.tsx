import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { Tooltip } from "@/components/Tooltip";
import {
  ArchiveIcon,
  BookmarkIcon,
  HeartBrokenIcon,
  HeartIcon,
  PlayIcon,
  PlusIcon,
} from "@/components/icons";
import {
  GAME_LOGS_CHANGED_EVENT,
  GAME_LOG_ACTION_LABEL,
  GAME_LOG_STATUS_ACTION_ICON,
  formatGameLogFullTime,
  formatGameLogItemTime,
  groupGameLogActivities,
  listLibraryGameLogs,
  resolveGameLogActionTone,
  type GameLogItem,
} from "@/features/library";
import { toErrorMessage } from "@/utils/errorMessage";
import "./GameDetailGroups.css";
import "./GameLogsPanel.css";

type GameLogsPanelProps = {
  gameId: number;
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

export function GameLogsPanel({ gameId }: GameLogsPanelProps) {
  const [logs, setLogs] = useState<GameLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => groupGameLogActivities(logs), [logs]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    async function refresh(showLoading: boolean) {
      if (showLoading) setLoading(true);
      try {
        const next = await listLibraryGameLogs(gameId, 200);
        if (!cancelled) {
          setLogs(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          if (showLoading) {
            setError(toErrorMessage(err, "加载日志失败"));
            setLogs([]);
          }
        }
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    }

    void refresh(true);
    void listen(GAME_LOGS_CHANGED_EVENT, () => {
      void refresh(false);
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [gameId]);

  if (loading) {
    return <p className="game-page-tab-empty">加载日志中…</p>;
  }

  if (error) {
    return <p className="game-page-tab-empty">{error}</p>;
  }

  if (groups.length === 0) {
    return <p className="game-page-tab-empty">暂无游戏日志</p>;
  }

  return (
    <div className="game-detail-groups">
      {groups.map((group) => (
        <section key={group.key} className="game-detail-group">
          <h3 className="game-detail-group-label">{group.label}</h3>
          <ul className="game-logs-list">
            {group.items.map((log) => {
              const actionText =
                GAME_LOG_ACTION_LABEL[log.action] ?? log.action;
              const actionTone = resolveGameLogActionTone(log.action);
              const actionIcon = ACTION_ICON[log.action] ?? (
                <PlusIcon aria-hidden />
              );
              const timeText = formatGameLogItemTime(log.createdAt);
              const fullTimeText = formatGameLogFullTime(log.createdAt);

              return (
                <li key={log.id} className="game-logs-item">
                  <span
                    className={[
                      "game-logs-action-icon",
                      `is-${actionTone}`,
                    ].join(" ")}
                    aria-hidden
                  >
                    {actionIcon}
                  </span>
                  <span
                    className={[
                      "game-logs-action",
                      `is-${actionTone}`,
                    ].join(" ")}
                  >
                    {actionText}
                  </span>
                  <Tooltip content={fullTimeText || undefined} placement="top">
                    <time
                      className="game-logs-time"
                      dateTime={fullTimeText || undefined}
                    >
                      {timeText}
                    </time>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
