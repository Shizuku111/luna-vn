import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/Button";
import { BookmarkIcon, HeartIcon, PlayIcon } from "@/components/icons";
import {
  getGameStudioName,
  asInfobox,
} from "@/features/bangumi";
import {
  formatLastPlayedRelative,
  resolveGameListNames,
  type LibraryGame,
} from "@/features/library";
import { useGameCoverUrl } from "@/hooks/useGameCoverUrl";
import "./HomeFeaturedCard.css";

export type HomeFeaturedSource = "open" | "import";

const FEATURED_SOURCE_LABEL: Record<HomeFeaturedSource, string> = {
  open: "上次游玩",
  import: "最新导入",
};

const FALLBACK_COVER_RATIO = 2 / 3;

type HomeFeaturedCardProps = {
  game: LibraryGame;
  source: HomeFeaturedSource;
  sourceAt?: string;
  showOriginalName?: boolean;
  onOpen?: (game: LibraryGame, origin?: DOMRect) => void;
  onLaunch?: (game: LibraryGame) => void;
};

function resolveFeaturedSourceLabel(
  source: HomeFeaturedSource,
  sourceAt?: string,
) {
  const base = FEATURED_SOURCE_LABEL[source];
  if (source !== "open" || !sourceAt) return base;
  const relative = formatLastPlayedRelative(sourceAt);
  return relative ? `${base} · ${relative}` : base;
}

export function HomeFeaturedCard({
  game,
  source,
  sourceAt,
  showOriginalName = true,
  onOpen,
  onLaunch,
}: HomeFeaturedCardProps) {
  const coverRef = useRef<HTMLDivElement>(null);
  const coverUrl = useGameCoverUrl(game, "detail");
  const [coverRatio, setCoverRatio] = useState(FALLBACK_COVER_RATIO);
  const { title, subtitle } = resolveGameListNames(game, showOriginalName);
  const studio = getGameStudioName(asInfobox(game.infobox));
  const sourceLabel = resolveFeaturedSourceLabel(source, sourceAt);

  useEffect(() => {
    if (!coverUrl) return;

    let cancelled = false;
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      if (cancelled) return;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setCoverRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = coverUrl;

    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  function handleOpen() {
    const origin = coverRef.current?.getBoundingClientRect();
    onOpen?.(game, origin);
  }

  function handleLaunch(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onLaunch?.(game);
  }

  function stopCardOpen(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <article className="home-featured-card" onClick={handleOpen}>
      {coverUrl ? (
        <div className="home-featured-card-bg" aria-hidden>
          <div
            className="home-featured-card-bg-image"
            style={{ backgroundImage: `url("${coverUrl.replace(/"/g, '\\"')}")` }}
          />
        </div>
      ) : (
        <div className="home-featured-card-bg is-empty" aria-hidden />
      )}
      <div className="home-featured-card-shade" aria-hidden />

      <div className="home-featured-card-body">
        <div className="home-featured-card-info">
          <div className="home-featured-card-flags">
            <span
              className={`home-featured-card-chip is-${source}`}
              aria-label={sourceLabel}
            >
              {sourceLabel}
            </span>
            {game.favorite ? (
              <span
                className="home-featured-card-chip is-favorite"
                aria-label="喜欢"
              >
                <HeartIcon
                  aria-hidden
                  className="library-favorite-icon is-favorite"
                />
              </span>
            ) : null}
            {game.wishlist ? (
              <span
                className="home-featured-card-chip is-wishlist"
                aria-label="想玩"
              >
                <BookmarkIcon
                  aria-hidden
                  className="library-wishlist-icon is-wishlist"
                />
              </span>
            ) : null}
          </div>
          <div className="home-featured-card-copy">
            <h2 className="home-featured-card-title" title={title}>
              {title}
            </h2>
            {subtitle ? (
              <p className="home-featured-card-subtitle" title={subtitle}>
                {subtitle}
              </p>
            ) : null}
            {studio ? (
              <p className="home-featured-card-studio" title={studio}>
                {studio}
              </p>
            ) : null}
            <div
              className="home-featured-card-actions"
              onClick={stopCardOpen}
              onMouseDown={stopCardOpen}
            >
              <Button
                theme="primary"
                size="large"
                prefix={<PlayIcon aria-hidden />}
                content="开始游戏"
                onClick={handleLaunch}
              />
            </div>
          </div>
        </div>

        {coverUrl ? (
          <div
            ref={coverRef}
            className="home-featured-card-cover"
            style={{ aspectRatio: String(coverRatio) }}
          >
            <img
              src={coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              draggable={false}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
