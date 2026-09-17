import { memo, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  BookmarkIcon,
  DetailsIcon,
  EditIcon,
  FolderIcon,
  HeartIcon,
  PlayIcon,
  TagIcon,
  TrashIcon,
} from "@/components/icons";
import { ContextMenu } from "@/components/ContextMenu";
import { asInfobox, getGameStudioName } from "@/features/bangumi";
import {
  LIBRARY_GAME_STATUS_ICON,
  LIBRARY_GAME_STATUS_OPTIONS,
  LibraryGameStatus,
  resolveGameCoverUrl,
  resolveGameListNames,
  type LibraryGame,
  type LibraryGameStatusValue,
} from "@/features/library";
import "./LibraryGameCard.css";

type LibraryGameCardProps = {
  game: LibraryGame;
  showOriginalName?: boolean;
  onOpen?: (game: LibraryGame, origin?: DOMRect) => void;
  onEdit?: (game: LibraryGame) => void;
  onLaunch?: (game: LibraryGame) => void;
  onReveal?: (game: LibraryGame) => void;
  onDelete?: (game: LibraryGame) => void;
  onStatusChange?: (game: LibraryGame, status: LibraryGameStatusValue) => void;
  onFavoriteChange?: (game: LibraryGame, favorite: boolean) => void;
  onWishlistChange?: (game: LibraryGame, wishlist: boolean) => void;
};

const OPEN_CLICK_DELAY_MS = 180;

const STATUS_MENU_CLASS: Record<LibraryGameStatusValue, string> = {
  [LibraryGameStatus.Playing]: "library-status-playing",
  [LibraryGameStatus.NotStarted]: "library-status-not-started",
  [LibraryGameStatus.Finished]: "library-status-finished",
  [LibraryGameStatus.OnHold]: "library-status-on-hold",
  [LibraryGameStatus.Dropped]: "library-status-dropped",
};

const STATUS_CHIP_LABEL: Record<LibraryGameStatusValue, string> = {
  [LibraryGameStatus.Playing]: "游玩中",
  [LibraryGameStatus.NotStarted]: "未开始",
  [LibraryGameStatus.Finished]: "已完成",
  [LibraryGameStatus.OnHold]: "搁置",
  [LibraryGameStatus.Dropped]: "弃置",
};

function getOpenOrigin(card: HTMLElement | null): DOMRect | undefined {
  if (!card) return undefined;
  const cover = card.querySelector(".library-game-cover");
  return (cover instanceof HTMLElement ? cover : card).getBoundingClientRect();
}

export const LibraryGameCard = memo(function LibraryGameCard({
  game,
  showOriginalName = true,
  onOpen,
  onEdit,
  onLaunch,
  onReveal,
  onDelete,
  onStatusChange,
  onFavoriteChange,
  onWishlistChange,
}: LibraryGameCardProps) {
  const cardRef = useRef<HTMLLIElement>(null);
  const openClickTimerRef = useRef<number | null>(null);
  const coverUrl = resolveGameCoverUrl(game, "list");
  const { title, subtitle } = resolveGameListNames(game, showOriginalName);
  const studio = getGameStudioName(asInfobox(game.infobox));
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (openClickTimerRef.current != null) {
        window.clearTimeout(openClickTimerRef.current);
      }
    };
  }, []);

  function clearOpenClickTimer() {
    if (openClickTimerRef.current == null) return;
    window.clearTimeout(openClickTimerRef.current);
    openClickTimerRef.current = null;
  }

  function handleCardClick() {
    clearOpenClickTimer();
    openClickTimerRef.current = window.setTimeout(() => {
      openClickTimerRef.current = null;
      onOpen?.(game, getOpenOrigin(cardRef.current));
    }, OPEN_CLICK_DELAY_MS);
  }

  function handleCardDoubleClick(event: MouseEvent) {
    event.preventDefault();
    clearOpenClickTimer();
    onLaunch?.(game);
  }

  function handleCardContextMenu(event: MouseEvent) {
    event.preventDefault();
    clearOpenClickTimer();
    setMenu({ x: event.clientX, y: event.clientY });
  }

  function handleCloseMenu() {
    setMenu(null);
  }

  const menuItems = useMemo(() => {
    if (menu == null) return [];
    return [
      {
        key: "launch",
        label: "开始游戏",
        icon: <PlayIcon aria-hidden />,
        onSelect: () => onLaunch?.(game),
      },
      {
        key: "details",
        label: "打开详情页",
        icon: <DetailsIcon aria-hidden />,
        onSelect: () => onOpen?.(game, getOpenOrigin(cardRef.current)),
      },
      {
        key: "favorite",
        label: game.favorite ? "取消喜欢" : "喜欢",
        className: game.favorite ? "library-favorite-active" : undefined,
        icon: (
          <HeartIcon
            aria-hidden
            className={
              game.favorite
                ? "library-favorite-icon is-favorite"
                : "library-favorite-icon"
            }
          />
        ),
        onSelect: () => onFavoriteChange?.(game, !game.favorite),
      },
      {
        key: "wishlist",
        label: game.wishlist ? "取消想玩" : "想玩",
        className: game.wishlist ? "library-wishlist-active" : undefined,
        icon: (
          <BookmarkIcon
            aria-hidden
            className={
              game.wishlist
                ? "library-wishlist-icon is-wishlist"
                : "library-wishlist-icon"
            }
          />
        ),
        onSelect: () => onWishlistChange?.(game, !game.wishlist),
      },
      {
        key: "edit",
        label: "编辑游戏",
        icon: <EditIcon aria-hidden />,
        onSelect: () => onEdit?.(game),
      },
      {
        key: "reveal",
        label: "打开所在文件夹",
        icon: <FolderIcon aria-hidden />,
        onSelect: () => onReveal?.(game),
      },
      {
        key: "mark",
        label: "标记为",
        icon: <TagIcon aria-hidden />,
        children: LIBRARY_GAME_STATUS_OPTIONS.map((option) => ({
          key: `status-${option.value}`,
          label: option.label,
          className: STATUS_MENU_CLASS[option.value],
          checked: option.value === game.status,
          icon: LIBRARY_GAME_STATUS_ICON[option.value],
          onSelect: () => onStatusChange?.(game, option.value),
        })),
      },
      {
        key: "delete",
        label: "删除游戏",
        icon: <TrashIcon aria-hidden />,
        danger: true,
        onSelect: () => onDelete?.(game),
      },
    ];
  }, [
    menu,
    game,
    onOpen,
    onEdit,
    onLaunch,
    onReveal,
    onDelete,
    onStatusChange,
    onFavoriteChange,
    onWishlistChange,
  ]);

  return (
    <>
      <li
        ref={cardRef}
        className={["library-game-card", STATUS_MENU_CLASS[game.status]].join(
          " ",
        )}
        onClick={handleCardClick}
        onDoubleClick={handleCardDoubleClick}
        onContextMenu={handleCardContextMenu}
      >
        <div className="library-game-cover">
          {coverUrl ? (
            <img
              key={game.coverPath ?? coverUrl ?? "cover"}
              src={coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              draggable={false}
            />
          ) : (
            <span className="library-game-cover-empty" aria-hidden />
          )}
          {game.wishlist || game.favorite ? (
            <div className="library-game-cover-badges">
              {game.wishlist ? (
                <span className="library-game-wishlist-badge" aria-label="想玩">
                  <BookmarkIcon
                    aria-hidden
                    className="library-wishlist-icon is-wishlist"
                  />
                </span>
              ) : null}
              {game.favorite ? (
                <span className="library-game-favorite-badge" aria-label="喜欢">
                  <HeartIcon
                    aria-hidden
                    className="library-favorite-icon is-favorite"
                  />
                </span>
              ) : null}
            </div>
          ) : null}
          {game.status !== LibraryGameStatus.NotStarted ? (
            <>
              <div className="library-game-cover-shade" aria-hidden />
              <span
                className={[
                  "library-game-status-icon",
                  STATUS_MENU_CLASS[game.status],
                ].join(" ")}
                aria-label={STATUS_CHIP_LABEL[game.status]}
                title={STATUS_CHIP_LABEL[game.status]}
              >
                {LIBRARY_GAME_STATUS_ICON[game.status]}
              </span>
            </>
          ) : null}
        </div>
        <div className="library-game-meta">
          <p className="library-game-title" title={title}>
            {title}
          </p>
          {subtitle ? (
            <p className="library-game-subtitle" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
          {studio ? (
            <p className="library-game-studio" title={studio}>
              {studio}
            </p>
          ) : null}
        </div>
      </li>

      {menu ? (
        <ContextMenu
          open
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={handleCloseMenu}
        />
      ) : null}
    </>
  );
});
