import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { DetailAtmosphere } from "@/components/DetailAtmosphere";
import { DialogConfirm } from "@/components/Dialog";
import type { DetailOpenOrigin } from "@/components/DetailOverlay";
import { DetailInfobox } from "@/components/DetailInfobox";
import { DetailSummary } from "@/components/DetailSummary";
import { DetailToolbar } from "@/components/DetailToolbar";
import { BookmarkIcon, HeartIcon, PlayIcon } from "@/components/icons";
import { MessagePlugin } from "@/components/Message";
import { ImageViewer } from "@/components/ImageViewer";
import { Switch } from "@/components/Switch";
import { Tabs } from "@/components/Tabs";
import { Tooltip } from "@/components/Tooltip";
import {
  asInfobox,
  bangumiGameTagUrl,
  bangumiSubjectUrl,
  buildGameInfoboxRows,
} from "@/features/bangumi";
import {
  deleteGame,
  launchGame,
  markGameFavorite,
  markGameWishlist,
  markGameStatus,
  openGameFolder,
} from "@/features/game";
import { syncLibraryGameCharacters } from "@/features/character";
import {
  ensureLibraryGameCover,
  formatGameLogFullTime,
  formatGameLogGroupLabel,
  getLibraryGame,
  LIBRARY_GAME_STATUS_ICON,
  LIBRARY_GAME_STATUS_OPTIONS,
  LibraryGameStatus,
  parseGameLogDate,
  syncLibraryGameRelations,
  updateLibraryGameFromBangumi,
  resolveGameCoverUrl,
  resolveGameListNames,
  updateLibraryGameRegionLaunch,
  type LibraryGame,
  type LibraryGameStatusValue,
} from "@/features/library";
import {
  ensureLEPathConfigured,
  useShowOriginalName,
} from "@/features/settings";
import { toErrorMessage } from "@/utils/errorMessage";
import { useRefreshSeq } from "@/hooks/useRefreshSeq";
import { openExternalUrl } from "@/utils/externalUrl";
import { extractAtmosphereColor } from "@/utils/extractAtmosphereColor";
import { GameCharactersPanel } from "./components/GameCharactersPanel";
import { GameLogsPanel } from "./components/GameLogsPanel";
import { GamePersonsPanel } from "./components/GamePersonsPanel";
import { GameRelatedPanel } from "./components/GameRelatedPanel";
import "./Game.css";

const EditGameDialog = lazy(() =>
  import("@/features/library/components/EditGameDialog").then((m) => ({
    default: m.EditGameDialog,
  })),
);

type GamePageProps = {
  gameId: number;
  onBack: () => void;
  onDeleted?: () => void;
  onUpdated?: (game: LibraryGame) => void;
  onOpenCharacter?: (
    characterId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
  onOpenPerson?: (
    personId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
  onOpenGame?: (
    gameId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
};

const STATUS_CLASS: Record<LibraryGameStatusValue, string> = {
  [LibraryGameStatus.Playing]: "game-status-playing",
  [LibraryGameStatus.NotStarted]: "game-status-not-started",
  [LibraryGameStatus.Finished]: "game-status-finished",
  [LibraryGameStatus.OnHold]: "game-status-on-hold",
  [LibraryGameStatus.Dropped]: "game-status-dropped",
};

const STATUS_SHORT_LABEL: Record<LibraryGameStatusValue, string> = {
  [LibraryGameStatus.Playing]: "正在游玩",
  [LibraryGameStatus.NotStarted]: "未开始",
  [LibraryGameStatus.Finished]: "完成",
  [LibraryGameStatus.OnHold]: "搁置",
  [LibraryGameStatus.Dropped]: "弃置",
};

const GAME_DETAIL_TABS = [
  { key: "characters", label: "角色" },
  { key: "related", label: "关联" },
  { key: "staff", label: "相关人员" },
  { key: "tags", label: "标签" },
  { key: "logs", label: "日志" },
] as const;

const SHOW_REGION_LAUNCH = true;

type GameDetailTabKey = (typeof GAME_DETAIL_TABS)[number]["key"];

export function GamePage({
  gameId,
  onBack,
  onDeleted,
  onUpdated,
  onOpenCharacter,
  onOpenPerson,
  onOpenGame,
}: GamePageProps) {
  const [game, setGame] = useState<LibraryGame | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<GameDetailTabKey>("characters");
  const [castRevision, setCastRevision] = useState(0);
  const [atmosphereRgb, setAtmosphereRgb] = useState<string | null>(null);
  const [coverLandscape, setCoverLandscape] = useState(false);
  const [coverBaseUrl, setCoverBaseUrl] = useState<string | null>(null);
  const [coverBaseReady, setCoverBaseReady] = useState(false);
  const [coverTopUrl, setCoverTopUrl] = useState<string | null>(null);
  const [coverTopReady, setCoverTopReady] = useState(false);
  const coverBaseUrlRef = useRef<string | null>(null);
  const coverTargetUrlRef = useRef<string | null>(null);
  const coverGameIdRef = useRef<number | null>(null);
  const launchMainRef = useRef<HTMLDivElement>(null);
  const regionLaunchRef = useRef<HTMLLabelElement>(null);
  const [regionLaunchBelow, setRegionLaunchBelow] = useState(false);
  const refreshSeq = useRefreshSeq();
  const actionLockRef = useRef(false);
  const statusUpdatingRef = useRef(false);
  const showOriginalName = useShowOriginalName();

  function applyGameUpdate(updated: LibraryGame) {
    setGame((current) => {
      if (!current || current.id !== updated.id) return updated;
      return {
        ...updated,
        coverPath: updated.coverPath ?? current.coverPath,
        coverThumbPath: updated.coverThumbPath ?? current.coverThumbPath,
      };
    });
  }

  function resetCoverState() {
    setCoverLandscape(false);
    setCoverBaseUrl(null);
    setCoverBaseReady(false);
    setCoverTopUrl(null);
    setCoverTopReady(false);
    coverBaseUrlRef.current = null;
    coverTargetUrlRef.current = null;
    coverGameIdRef.current = null;
  }

  async function refresh() {
    const seq = refreshSeq.begin();
    const requestedId = gameId;
    try {
      setNotFound(false);
      const next = await getLibraryGame(requestedId);
      if (!refreshSeq.isCurrent(seq)) return;
      setGame(next);

      if (next.coverPath?.trim()) return;

      void ensureLibraryGameCover(requestedId)
        .then((withCover) => {
          if (!refreshSeq.isCurrent(seq)) return;
          if (!withCover.coverPath?.trim() && !withCover.coverThumbPath?.trim()) {
            return;
          }
          setGame((current) => {
            if (!current || current.id !== withCover.id) return current;
            if (
              current.coverPath === withCover.coverPath &&
              current.coverThumbPath === withCover.coverThumbPath
            ) {
              return current;
            }
            return {
              ...current,
              coverPath: withCover.coverPath ?? current.coverPath,
              coverThumbPath: withCover.coverThumbPath ?? current.coverThumbPath,
            };
          });
        })
        .catch((err) => {
          if (!refreshSeq.isCurrent(seq)) return;
          MessagePlugin.warning(
            toErrorMessage(err, "封面同步失败，可稍后重试"),
          );
        });
    } catch (err) {
      if (!refreshSeq.isCurrent(seq)) return;
      MessagePlugin.error(toErrorMessage(err, "加载游戏详情失败"));
      setGame(null);
      setNotFound(true);
    }
  }

  const resetPageForGameId = useEffectEvent(() => {
    setGame(null);
    setNotFound(false);
    setActiveTab("characters");
    setAtmosphereRgb(null);
    resetCoverState();
    void refresh();
  });

  useEffect(() => {
    resetPageForGameId();
  }, [gameId]);

  const coverUrlForAtmosphere = game
    ? resolveGameCoverUrl(game, "thumb")
    : null;

  useEffect(() => {
    let cancelled = false;
    if (!coverUrlForAtmosphere) return;

    void extractAtmosphereColor(coverUrlForAtmosphere).then((color) => {
      if (cancelled || !color) return;
      setAtmosphereRgb(`${color.r}, ${color.g}, ${color.b}`);
    });

    return () => {
      cancelled = true;
    };
  }, [coverUrlForAtmosphere]);

  const coverUrl = game ? resolveGameCoverUrl(game, "detail") : null;

  useEffect(() => {
    if (!game) {
      resetCoverState();
      return;
    }
    if (!coverUrl) return;

    if (coverGameIdRef.current !== game.id) {
      coverGameIdRef.current = game.id;
      coverBaseUrlRef.current = null;
      coverTargetUrlRef.current = null;
      setCoverBaseUrl(null);
      setCoverBaseReady(false);
      setCoverTopUrl(null);
      setCoverTopReady(false);
    }

    if (coverUrl === coverTargetUrlRef.current) return;
    coverTargetUrlRef.current = coverUrl;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled || coverGameIdRef.current !== game.id) return;
      if (coverTargetUrlRef.current !== coverUrl) return;
      const landscape =
        img.naturalWidth > 0 &&
        img.naturalHeight > 0 &&
        img.naturalWidth > img.naturalHeight;

      if (!coverBaseUrlRef.current) {
        coverBaseUrlRef.current = coverUrl;
        setCoverBaseUrl(coverUrl);
        setCoverBaseReady(false);
        setCoverLandscape(landscape);
        setCoverTopUrl(null);
        setCoverTopReady(false);
        return;
      }

      if (coverBaseUrlRef.current === coverUrl) return;

      setCoverTopReady(false);
      setCoverTopUrl(coverUrl);
      setCoverLandscape(landscape);
    };
    img.onerror = () => {
      if (cancelled || coverGameIdRef.current !== game.id) return;
      if (!coverBaseUrlRef.current) {
        coverBaseUrlRef.current = coverUrl;
        setCoverBaseUrl(coverUrl);
        setCoverBaseReady(true);
      }
    };
    img.src = coverUrl;

    return () => {
      cancelled = true;
    };
  }, [game, coverUrl]);

  function handleCoverTopLoad() {
    const url = coverTopUrl;
    if (!url) return;
    setCoverTopReady(true);
    window.setTimeout(() => {
      if (coverGameIdRef.current == null) return;
      coverBaseUrlRef.current = url;
      setCoverBaseUrl(url);
      setCoverBaseReady(true);
      setCoverTopUrl((current) => (current === url ? null : current));
      setCoverTopReady(false);
    }, 180);
  }

  const infoboxRows = useMemo(() => {
    if (!game) return [];
    return buildGameInfoboxRows(asInfobox(game.infobox), game.date);
  }, [game]);

  if (!game) {
    if (!notFound) {
      return <section className="game-page" aria-busy="true" />;
    }
    return (
      <section className="game-page">
        <p className="game-page-empty">未找到该游戏。</p>
        <Button content="返回游戏库" onClick={onBack} />
      </section>
    );
  }

  const current = game;
  const { title, subtitle } = resolveGameListNames(current, showOriginalName);
  const summary = current.summary?.trim() ?? "";
  const lastLaunchedDate = parseGameLogDate(current.lastLaunchedAt ?? "");
  const lastLaunchedText = lastLaunchedDate
    ? formatGameLogGroupLabel(lastLaunchedDate)
    : "从未运行";
  const lastLaunchedFull = lastLaunchedDate
    ? formatGameLogFullTime(current.lastLaunchedAt ?? "")
    : "";

  function updateRegionLaunchPlacement() {
    const main = launchMainRef.current;
    const panel = regionLaunchRef.current;
    if (!main || !panel) return;
    const mainRect = main.getBoundingClientRect();
    const panelHeight = Math.max(panel.offsetHeight, 40);
    const gap = 6;
    const edgePad = 12;
    setRegionLaunchBelow(mainRect.top < panelHeight + gap + edgePad);
  }

  function handleOpenEdit() {
    setEditOpen(true);
  }

  function handleCloseEdit() {
    setEditOpen(false);
  }

  function handleEditSaved(updated: LibraryGame) {
    applyGameUpdate(updated);
    onUpdated?.(updated);
  }

  function handleTabChange(key: string) {
    setActiveTab(key as GameDetailTabKey);
  }

  function handleUpdateBangumi() {
    if (deleting || actionLockRef.current) return;
    void (async () => {
      await DialogConfirm({
        title: "更新 Bangumi 信息",
        content: `确定重新获取「${title}」的 Bangumi 条目信息吗？将更新名称、简介、评分、封面等条目数据，并重新同步角色、人物与关联游戏；启动路径与游玩状态等不会改动。`,
        confirmText: "更新",
        onConfirm: async () => {
          if (actionLockRef.current) return;
          actionLockRef.current = true;
          try {
            const updated = await updateLibraryGameFromBangumi(current);
            await syncLibraryGameCharacters(updated.id, updated.bangumiId);
            await syncLibraryGameRelations(updated.id, updated.bangumiId);
            applyGameUpdate(updated);
            setCastRevision((value) => value + 1);
            onUpdated?.(updated);
            MessagePlugin.success("已更新 Bangumi 信息");
          } catch (err) {
            MessagePlugin.error(toErrorMessage(err, "更新失败"));
            throw err;
          } finally {
            actionLockRef.current = false;
          }
        },
      });
    })();
  }

  function handleDeleteGame() {
    if (deleting || actionLockRef.current) return;
    void (async () => {
      const ok = await DialogConfirm({
        title: "删除游戏",
        content: `确定删除「${title}」吗？此操作不可恢复。`,
        confirmText: "删除",
        confirmTheme: "danger",
      });
      if (!ok) return;

      actionLockRef.current = true;
      setDeleting(true);
      try {
        await deleteGame(current);
        MessagePlugin.success("已删除游戏");
        onDeleted?.();
        onBack();
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "删除失败"));
        setDeleting(false);
      } finally {
        actionLockRef.current = false;
      }
    })();
  }

  function handleLaunchGame() {
    if (actionLockRef.current || deleting) return;
    void (async () => {
      actionLockRef.current = true;
      try {
        const { game: updated } = await launchGame(current);
        applyGameUpdate(updated);
        onUpdated?.(updated);
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "启动失败"));
      } finally {
        actionLockRef.current = false;
      }
    })();
  }

  function handleRegionLaunchChange(checked: boolean) {
    if (actionLockRef.current || deleting) return;
    void (async () => {
      actionLockRef.current = true;
      try {
        if (checked) {
          const ready = await ensureLEPathConfigured();
          if (!ready) return;

          const updated = await updateLibraryGameRegionLaunch(current.id, true);
          applyGameUpdate(updated);
          onUpdated?.(updated);
          return;
        }

        const updated = await updateLibraryGameRegionLaunch(current.id, false);
        applyGameUpdate(updated);
        onUpdated?.(updated);
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "更新转区启动失败"));
      } finally {
        actionLockRef.current = false;
      }
    })();
  }

  function handleOpenGameFolder() {
    if (actionLockRef.current || deleting) return;
    void (async () => {
      actionLockRef.current = true;
      try {
        await openGameFolder(current);
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "打开文件夹失败"));
      } finally {
        actionLockRef.current = false;
      }
    })();
  }

  function handleFavoriteToggle() {
    if (actionLockRef.current || deleting) return;
    void (async () => {
      const nextFavorite = !current.favorite;
      if (!nextFavorite) {
        const ok = await DialogConfirm({
          title: "取消喜欢",
          content: `确定取消「${title}」的喜欢吗？`,
          confirmText: "取消喜欢",
        });
        if (!ok) return;
      }

      actionLockRef.current = true;
      try {
        const updated = await markGameFavorite(current, nextFavorite);
        applyGameUpdate(updated);
        onUpdated?.(updated);
        MessagePlugin.success(nextFavorite ? "已设为喜欢" : "已取消喜欢");
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "更新喜欢失败"));
      } finally {
        actionLockRef.current = false;
      }
    })();
  }

  function handleWishlistToggle() {
    if (actionLockRef.current || deleting) return;
    void (async () => {
      const nextWishlist = !current.wishlist;
      if (!nextWishlist) {
        const ok = await DialogConfirm({
          title: "取消想玩",
          content: `确定取消「${title}」的想玩吗？`,
          confirmText: "取消想玩",
        });
        if (!ok) return;
      }

      actionLockRef.current = true;
      try {
        const updated = await markGameWishlist(current, nextWishlist);
        applyGameUpdate(updated);
        onUpdated?.(updated);
        MessagePlugin.success(nextWishlist ? "已设为想玩" : "已取消想玩");
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "更新想玩失败"));
      } finally {
        actionLockRef.current = false;
      }
    })();
  }

  function handleOpenBangumi() {
    void (async () => {
      try {
        await openExternalUrl(bangumiSubjectUrl(current.bangumiId));
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "打开 Bangumi 失败"));
      }
    })();
  }

  function handleOpenCover() {
    const src = coverUrl ?? coverBaseUrl;
    if (!src) return;
    void ImageViewer.open({ src, alt: title });
  }

  function handleOpenBangumiTag(tag: string) {
    void (async () => {
      try {
        await openExternalUrl(bangumiGameTagUrl(tag));
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "打开标签页失败"));
      }
    })();
  }

  function handleStatusChange(status: LibraryGameStatusValue) {
    if (
      current.status === status ||
      deleting ||
      actionLockRef.current ||
      statusUpdatingRef.current
    ) {
      return;
    }
    const previous = current;
    statusUpdatingRef.current = true;
    setGame({ ...current, status });
    void (async () => {
      try {
        const updated = await markGameStatus(previous, status);
        applyGameUpdate(updated);
        onUpdated?.(updated);
      } catch (err) {
        setGame(previous);
        MessagePlugin.error(toErrorMessage(err, "更新状态失败"));
      } finally {
        statusUpdatingRef.current = false;
      }
    })();
  }

  function handleOpenInfoboxLink(href: string) {
    void (async () => {
      try {
        await openExternalUrl(href);
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "打开链接失败"));
      }
    })();
  }

  return (
    <>
      <DetailAtmosphere imageUrl={coverBaseUrl} colorRgb={atmosphereRgb} />
      <section className="game-page">
        <DetailToolbar
          onClose={onBack}
          onOpenBangumi={
            current.bangumiId > 0 ? handleOpenBangumi : undefined
          }
          deleting={deleting}
          moreItems={[
            ...(current.bangumiId > 0
              ? [
                  {
                    key: "refresh",
                    label: "更新 Bangumi 信息",
                    onSelect: handleUpdateBangumi,
                  },
                ]
              : []),
            {
              key: "folder",
              label: "打开所在文件夹",
              onSelect: handleOpenGameFolder,
            },
            {
              key: "edit",
              label: "编辑游戏",
              onSelect: handleOpenEdit,
            },
            {
              key: "delete",
              label: "删除游戏",
              danger: true,
              onSelect: handleDeleteGame,
            },
          ]}
        />

        <div
          className={[
            "game-page-body",
            coverLandscape ? "is-landscape" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="game-page-col-main">
            <div className="game-page-cover">
              {coverBaseUrl ? (
                <Tooltip content="点击查看" followCursor delay={120}>
                  <button
                    type="button"
                    className="game-page-cover-button"
                    aria-label="查看封面大图"
                    onClick={handleOpenCover}
                  >
                    <img
                      className={coverBaseReady ? "is-ready" : ""}
                      src={coverBaseUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      decoding="async"
                      onLoad={() => setCoverBaseReady(true)}
                    />
                    {coverTopUrl ? (
                      <img
                        className={["is-pending", coverTopReady ? "is-ready" : ""]
                          .filter(Boolean)
                          .join(" ")}
                        src={coverTopUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        decoding="async"
                        aria-hidden
                        onLoad={handleCoverTopLoad}
                      />
                    ) : null}
                  </button>
                </Tooltip>
              ) : (
                <span className="game-page-cover-empty" aria-hidden />
              )}
            </div>

            <aside className="game-page-aside">
              <DetailInfobox
                rows={infoboxRows}
                onOpenLink={handleOpenInfoboxLink}
              />
            </aside>
          </div>

          <div className="game-page-col-side">
            <div className="game-page-hero">
              <div className="game-page-title-block">
                <h1 className="game-page-title" title={title}>
                  <span className="game-page-title-text">{title}</span>
                </h1>
                <p
                  className={[
                    "game-page-subtitle",
                    subtitle ? "" : "is-empty",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={subtitle || undefined}
                  aria-hidden={subtitle ? undefined : true}
                >
                  {subtitle || "\u00A0"}
                </p>
              </div>

              <DetailSummary summary={summary} fillHeight={coverLandscape} />
            </div>

            <div className="game-page-meta">
              <div className="game-page-primary-actions">
                <div className="game-page-launch-cluster">
                  <div
                    ref={launchMainRef}
                    className="game-page-launch-main"
                    onMouseEnter={updateRegionLaunchPlacement}
                    onFocus={updateRegionLaunchPlacement}
                  >
                    <Button
                      theme="primary"
                      size="large"
                      className="game-page-launch-btn"
                      prefix={<PlayIcon size={20} aria-hidden />}
                      content="开始游戏"
                      onClick={handleLaunchGame}
                    />
                    {SHOW_REGION_LAUNCH ? (
                      <label
                        ref={regionLaunchRef}
                        className={[
                          "game-page-region-launch",
                          regionLaunchBelow ? "is-below" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        title="Locale Emulator"
                      >
                        <span className="game-page-region-launch-label">
                          转区启动
                        </span>
                        <Switch
                          checked={Boolean(current.regionLaunch)}
                          aria-label="转区启动（Locale Emulator）"
                          disabled={deleting}
                          onChange={handleRegionLaunchChange}
                        />
                      </label>
                    ) : null}
                  </div>
                  <Tooltip
                    content={lastLaunchedFull}
                    placement="top"
                    disabled={!lastLaunchedFull}
                  >
                    <div className="game-page-last-run">
                      <span className="game-page-last-run-label">上次运行</span>
                      <span
                        className={[
                          "game-page-last-run-value",
                          lastLaunchedDate ? "" : "is-empty",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {lastLaunchedText}
                      </span>
                    </div>
                  </Tooltip>
                </div>
                <div className="game-page-action-trailing">
                  <div className="game-page-mark-btns">
                    <Button
                      size="small"
                      className={[
                        "game-page-want-btn",
                        current.wishlist ? "is-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      prefix={
                        <BookmarkIcon
                          aria-hidden
                          className={
                            current.wishlist
                              ? "library-wishlist-icon is-wishlist"
                              : "library-wishlist-icon"
                          }
                        />
                      }
                      content={current.wishlist ? "取消想玩" : "想玩"}
                      aria-pressed={current.wishlist}
                      onClick={handleWishlistToggle}
                    />
                    <Button
                      size="small"
                      className={[
                        "game-page-favorite-btn",
                        current.favorite ? "is-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      prefix={
                        <HeartIcon
                          aria-hidden
                          className={
                            current.favorite
                              ? "library-favorite-icon is-favorite"
                              : "library-favorite-icon"
                          }
                        />
                      }
                      content={current.favorite ? "取消喜欢" : "喜欢"}
                      aria-pressed={current.favorite}
                      onClick={handleFavoriteToggle}
                    />
                  </div>
                  <div
                    className="game-page-status-icons"
                    role="group"
                    aria-label="游戏状态"
                  >
                    {LIBRARY_GAME_STATUS_OPTIONS.map((option) => {
                      const active = current.status === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={[
                            "game-page-status-icon-btn",
                            STATUS_CLASS[option.value],
                            active ? "is-active" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-label={option.label}
                          aria-pressed={active}
                          title={option.label}
                          disabled={deleting}
                          onClick={() => handleStatusChange(option.value)}
                        >
                          <span
                            className="game-page-status-icon-btn-glyph"
                            aria-hidden
                          >
                            {LIBRARY_GAME_STATUS_ICON[option.value]}
                          </span>
                          {active ? (
                            <span className="game-page-status-icon-btn-label">
                              {STATUS_SHORT_LABEL[option.value]}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <Tabs
                className="game-page-tabs"
                shortIndicator
                items={[...GAME_DETAIL_TABS]}
                value={activeTab}
                onChange={handleTabChange}
                aria-label="游戏详情"
              />
              <div className="game-page-tab-panel" role="tabpanel">
                {activeTab === "characters" ? (
                  <GameCharactersPanel
                    gameId={current.id}
                    refreshToken={castRevision}
                    onOpenCharacter={onOpenCharacter}
                  />
                ) : null}
                {activeTab === "related" ? (
                  <GameRelatedPanel
                    gameId={current.id}
                    refreshToken={castRevision}
                    onOpenGame={onOpenGame}
                  />
                ) : null}
                {activeTab === "staff" ? (
                  <GamePersonsPanel
                    gameId={current.id}
                    refreshToken={castRevision}
                    onOpenPerson={onOpenPerson}
                  />
                ) : null}
                {activeTab === "tags" ? (
                  current.tags.length > 0 ? (
                    <ul className="game-page-tag-list">
                      {current.tags.map((tag) => (
                        <li key={tag}>
                          <button
                            type="button"
                            className="game-page-tag"
                            title={`在Bangumi打开：${tag}`}
                            onClick={() => handleOpenBangumiTag(tag)}
                          >
                            {tag}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="game-page-tab-empty">暂无标签</p>
                  )
                ) : null}
                {activeTab === "logs" ? (
                  <GameLogsPanel gameId={current.id} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Suspense fallback={<div className="app-page-fallback" aria-busy="true" />}>
        <EditGameDialog
          key={editOpen ? `edit-${current.id}` : "edit-closed"}
          open={editOpen}
          game={current}
          onClose={handleCloseEdit}
          onSaved={handleEditSaved}
        />
      </Suspense>
    </>
  );
}
