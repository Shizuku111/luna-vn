import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { DetailAtmosphere } from "@/components/DetailAtmosphere";
import type { DetailOpenOrigin } from "@/components/DetailOverlay";
import { DetailInfobox } from "@/components/DetailInfobox";
import { DetailSummary } from "@/components/DetailSummary";
import { DetailToolbar } from "@/components/DetailToolbar";
import { DialogConfirm } from "@/components/Dialog";
import { ImageViewer } from "@/components/ImageViewer";
import { MessagePlugin } from "@/components/Message";
import { HeartIcon } from "@/components/icons";
import { Tile } from "@/components/Tile";
import { Tooltip } from "@/components/Tooltip";
import {
  asInfobox,
  bangumiCharacterUrl,
  bangumiPersonUrl,
  buildInfoboxRows,
  findInfoboxValue,
  NAME_CN_KEYS,
} from "@/features/bangumi";
import {
  deleteCharacter,
  getLibraryCharacter,
  listCharacterGames,
  markCharacterFavorite,
  refreshCharacter,
  type CharacterGameAppearance,
  type LibraryCharacter,
  type LibraryCharacterActor,
} from "@/features/character";
import { resolveGameListNames } from "@/features/library";
import {
  deletePerson,
  getLibraryPerson,
  listPersonCharacters,
  listPersonParticipations,
  markPersonFavorite,
  refreshPerson,
  type LibraryPerson,
  type PersonCharacterAppearance,
  type PersonCharacterGame,
  type PersonGameParticipation,
} from "@/features/person";
import { useShowOriginalName } from "@/features/settings";
import { useCachedEntityImage } from "@/features/entityImage";
import { useRefreshSeq } from "@/hooks/useRefreshSeq";
import { extractAtmosphereColor } from "@/utils/extractAtmosphereColor";
import { openExternalUrl } from "@/utils/externalUrl";
import { toErrorMessage } from "@/utils/errorMessage";
import "./Entity.css";

export type EntityKind = "character" | "person";

type EntityPageProps = {
  kind: EntityKind;
  entityId: number;
  onBack: () => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
  onOpenGame?: (gameId: number, origin?: DetailOpenOrigin | null) => void;
  onOpenCharacter?: (
    characterId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
  onOpenPerson?: (
    personId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
};

function getOpenOrigin(el: HTMLElement | null): DetailOpenOrigin | undefined {
  if (!el) return undefined;
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function EntityPage({
  kind,
  entityId,
  onBack,
  onDeleted,
  onUpdated,
  onOpenGame,
  onOpenCharacter,
  onOpenPerson,
}: EntityPageProps) {
  const [entity, setEntity] = useState<LibraryCharacter | LibraryPerson | null>(
    null,
  );
  const [games, setGames] = useState<CharacterGameAppearance[]>([]);
  const [appearances, setAppearances] = useState<PersonCharacterAppearance[]>(
    [],
  );
  const [participations, setParticipations] = useState<
    PersonGameParticipation[]
  >([]);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [atmosphereRgb, setAtmosphereRgb] = useState<string | null>(null);
  const actionLockRef = useRef(false);
  const refreshSeq = useRefreshSeq();
  const kindLabel = kind === "character" ? "角色" : "人物";
  const entityImageUrl = useCachedEntityImage({
    kind,
    id: entity?.id ?? entityId,
    images: entity?.images,
    preferDetail: true,
  });
  const entityThumbUrl = useCachedEntityImage({
    kind,
    id: entity?.id ?? entityId,
    images: entity?.images,
    preferDetail: false,
  });

  async function refresh() {
    const seq = refreshSeq.begin();
    const requestedKind = kind;
    const requestedId = entityId;
    try {
      setNotFound(false);
      if (requestedKind === "character") {
        const next = await getLibraryCharacter(requestedId);
        if (!refreshSeq.isCurrent(seq)) return;
        setEntity(next);
        setRelatedLoading(true);
        try {
          const nextGames = await listCharacterGames(requestedId);
          if (!refreshSeq.isCurrent(seq)) return;
          setGames(nextGames);
        } catch (err) {
          if (!refreshSeq.isCurrent(seq)) return;
          MessagePlugin.error(toErrorMessage(err, "加载出演作品失败"));
          setGames([]);
        } finally {
          if (refreshSeq.isCurrent(seq)) setRelatedLoading(false);
        }
      } else {
        const next = await getLibraryPerson(requestedId);
        if (!refreshSeq.isCurrent(seq)) return;
        setEntity(next);
        setRelatedLoading(true);
        try {
          const [nextAppearances, nextParticipations] = await Promise.all([
            listPersonCharacters(requestedId),
            listPersonParticipations(requestedId),
          ]);
          if (!refreshSeq.isCurrent(seq)) return;
          setAppearances(nextAppearances);
          setParticipations(nextParticipations);
        } catch (err) {
          if (!refreshSeq.isCurrent(seq)) return;
          MessagePlugin.error(toErrorMessage(err, "加载关联内容失败"));
          setAppearances([]);
          setParticipations([]);
        } finally {
          if (refreshSeq.isCurrent(seq)) setRelatedLoading(false);
        }
      }
    } catch (err) {
      if (!refreshSeq.isCurrent(seq)) return;
      MessagePlugin.error(
        toErrorMessage(err, `加载${kindLabel}详情失败`),
      );
      setEntity(null);
      setNotFound(true);
      setRelatedLoading(false);
    }
  }

  const resetPageForEntity = useEffectEvent(() => {
    setEntity(null);
    setNotFound(false);
    setGames([]);
    setAppearances([]);
    setParticipations([]);
    setAtmosphereRgb(null);
    void refresh();
  });

  useEffect(() => {
    resetPageForEntity();
  }, [kind, entityId]);

  useEffect(() => {
    let cancelled = false;
    setAtmosphereRgb(null);
    if (!entityThumbUrl) return;

    void extractAtmosphereColor(entityThumbUrl).then((color) => {
      if (cancelled || !color) return;
      setAtmosphereRgb(`${color.r}, ${color.g}, ${color.b}`);
    });

    return () => {
      cancelled = true;
    };
  }, [entityThumbUrl]);

  const display = useMemo(() => {
    if (!entity) {
      return { nameCn: "" };
    }
    const infobox = asInfobox(entity.infobox);
    const nameCn = findInfoboxValue(infobox, NAME_CN_KEYS);
    return {
      nameCn: nameCn && nameCn !== entity.name ? nameCn : "",
    };
  }, [entity]);

  const infoboxRows = useMemo(() => {
    if (!entity) return [];
    return buildInfoboxRows(asInfobox(entity.infobox));
  }, [entity]);

  if (!entity) {
    if (!notFound) {
      return <section className="entity-page" aria-busy="true" />;
    }
    return (
      <section className="entity-page">
        <p className="entity-page-empty">未找到该{kindLabel}。</p>
        <Button content="返回" onClick={onBack} />
      </section>
    );
  }

  const current = entity;
  const summary = current.summary?.trim() ?? "";

  function handleOpenInfoboxLink(href: string) {
    void (async () => {
      try {
        await openExternalUrl(href);
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "打开链接失败"));
      }
    })();
  }

  function handleRefresh() {
    if (deleting || actionLockRef.current) return;
    void (async () => {
      await DialogConfirm({
        title: `更新 Bangumi 信息`,
        content: `确定重新获取「${current.name}」的 Bangumi ${kindLabel}信息吗？`,
        confirmText: "更新",
        onConfirm: async () => {
          if (actionLockRef.current) return;
          actionLockRef.current = true;
          try {
            if (kind === "character") {
              const updated = await refreshCharacter(current.id);
              setEntity(updated);
              setGames(await listCharacterGames(current.id));
            } else {
              const updated = await refreshPerson(current.id);
              setEntity(updated);
              const [nextAppearances, nextParticipations] = await Promise.all([
                listPersonCharacters(current.id),
                listPersonParticipations(current.id),
              ]);
              setAppearances(nextAppearances);
              setParticipations(nextParticipations);
            }
            onUpdated?.();
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

  function handleDelete() {
    if (deleting || actionLockRef.current) return;
    void (async () => {
      const ok = await DialogConfirm({
        title: `删除${kindLabel}`,
        content: `确定删除「${current.name}」吗？此操作不可恢复。`,
        confirmText: "删除",
        confirmTheme: "danger",
      });
      if (!ok) return;

      actionLockRef.current = true;
      setDeleting(true);
      try {
        if (kind === "character") {
          await deleteCharacter(current as LibraryCharacter);
        } else {
          await deletePerson(current as LibraryPerson);
        }
        MessagePlugin.success(`已删除${kindLabel}`);
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

  function handleOpenBangumi() {
    void (async () => {
      try {
        const url =
          kind === "character"
            ? bangumiCharacterUrl(current.id)
            : bangumiPersonUrl(current.id);
        await openExternalUrl(url);
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "打开 Bangumi 失败"));
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
          content: `确定取消「${current.name}」的喜欢吗？`,
          confirmText: "取消喜欢",
        });
        if (!ok) return;
      }

      actionLockRef.current = true;
      try {
        const updated =
          kind === "character"
            ? await markCharacterFavorite(
                current as LibraryCharacter,
                nextFavorite,
              )
            : await markPersonFavorite(current as LibraryPerson, nextFavorite);
        setEntity(updated);
        onUpdated?.();
        MessagePlugin.success(nextFavorite ? "已设为喜欢" : "已取消喜欢");
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "更新喜欢失败"));
      } finally {
        actionLockRef.current = false;
      }
    })();
  }

  function handleOpenAvatar() {
    if (!entityImageUrl) return;
    void ImageViewer.open({
      src: entityImageUrl,
      alt: current.name,
    });
  }

  function handleOpenGame(
    game: CharacterGameAppearance,
    avatarEl: HTMLElement | null,
  ) {
    onOpenGame?.(game.id, getOpenOrigin(avatarEl) ?? null);
  }

  function handleOpenRelatedCharacter(
    appearance: PersonCharacterAppearance,
    avatarEl: HTMLElement | null,
  ) {
    onOpenCharacter?.(appearance.id, getOpenOrigin(avatarEl) ?? null);
  }

  function handleOpenPerformanceGame(
    game: PersonCharacterGame,
    coverEl: HTMLElement | null,
  ) {
    onOpenGame?.(game.id, getOpenOrigin(coverEl) ?? null);
  }

  function handleOpenParticipationGame(
    item: PersonGameParticipation,
    coverEl: HTMLElement | null,
  ) {
    onOpenGame?.(item.id, getOpenOrigin(coverEl) ?? null);
  }

  return (
    <>
    <DetailAtmosphere imageUrl={entityImageUrl} colorRgb={atmosphereRgb} />
    <section className="entity-page">
      <DetailToolbar
        onClose={onBack}
        onOpenBangumi={handleOpenBangumi}
        deleting={deleting}
        moreItems={[
          {
            key: "refresh",
            label: "更新 Bangumi 信息",
            onSelect: handleRefresh,
          },
          {
            key: "delete",
            label: `删除${kindLabel}`,
            danger: true,
            onSelect: handleDelete,
          },
        ]}
      />

      <div className="entity-page-body">
        <aside className="entity-page-aside">
          <div className="entity-page-avatar">
            {entityImageUrl ? (
              <Tooltip content="点击查看" followCursor delay={120}>
                <button
                  type="button"
                  className="entity-page-avatar-button"
                  aria-label={`查看${kindLabel}图片`}
                  onClick={handleOpenAvatar}
                >
                  <img
                    src={entityImageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                </button>
              </Tooltip>
            ) : (
              <span className="entity-page-avatar-empty" aria-hidden />
            )}
          </div>
          <DetailInfobox
            rows={infoboxRows}
            onOpenLink={handleOpenInfoboxLink}
          />
        </aside>

        <div className="entity-page-meta">
          <div className="entity-page-hero">
            <div className="entity-page-title-row">
              <div className="entity-page-title-block">
                <h1 className="entity-page-title">{current.name}</h1>
                {display.nameCn ? (
                  <p className="entity-page-subtitle">{display.nameCn}</p>
                ) : null}
              </div>
              <div className="entity-page-title-marks">
                <Button
                  className={[
                    "entity-page-favorite-btn",
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
            </div>

            <DetailSummary summary={summary} />
          </div>

          <div className="entity-page-related">
            {kind === "character" ? (
              <>
                <h2 className="entity-page-section-title">出演</h2>
                {relatedLoading ? (
                  <p className="entity-page-related-empty">加载中…</p>
                ) : games.length === 0 ? (
                  <p className="entity-page-related-empty">暂无出演作品</p>
                ) : (
                  <ul className="entity-appearance-list">
                    {games.map((game) => (
                      <RelatedGameRow
                        key={game.id}
                        game={game}
                        onOpen={handleOpenGame}
                        onOpenPerson={onOpenPerson}
                      />
                    ))}
                  </ul>
                )}
              </>
            ) : relatedLoading ? (
              <p className="entity-page-related-empty">加载中…</p>
            ) : appearances.length === 0 && participations.length === 0 ? (
              <p className="entity-page-related-empty">暂无关联信息</p>
            ) : (
              <>
                {appearances.length > 0 ? (
                  <>
                    <h2 className="entity-page-section-title">演出</h2>
                    <ul className="entity-appearance-list">
                      {appearances.map((appearance) => (
                        <RelatedPerformanceRow
                          key={appearance.id}
                          appearance={appearance}
                          onOpenCharacter={handleOpenRelatedCharacter}
                          onOpenGame={handleOpenPerformanceGame}
                        />
                      ))}
                    </ul>
                  </>
                ) : null}

                {participations.length > 0 ? (
                  <>
                    <h2
                      className={[
                        "entity-page-section-title",
                        appearances.length > 0
                          ? "entity-page-section-title-spaced"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      参与
                    </h2>
                    <ul className="entity-appearance-list">
                      {participations.map((item) => (
                        <RelatedParticipationRow
                          key={item.id}
                          item={item}
                          onOpen={handleOpenParticipationGame}
                        />
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
    </>
  );
}

function AppearanceActorButton({
  actor,
  onOpenPerson,
}: {
  actor: LibraryCharacterActor;
  onOpenPerson?: (
    personId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const showOriginalName = useShowOriginalName();
  const imageUrl = useCachedEntityImage({
    kind: "person",
    id: actor.id,
    images: actor.images,
  });
  const { title, subtitle } = resolveGameListNames(
    { name: actor.name, nameCn: actor.nameCn ?? "" },
    showOriginalName,
  );
  const relation = actor.relation?.trim() ?? "";

  return (
    <Tile
      className="entity-appearance-actor"
      plain
      title={title}
      lines={[subtitle, relation]}
      imageUrl={imageUrl}
      imageShape="circle"
      imageSide="right"
      mediaRef={mediaRef}
      onClick={
        onOpenPerson
          ? () =>
              onOpenPerson(
                actor.id,
                getOpenOrigin(mediaRef.current) ?? null,
              )
          : undefined
      }
    />
  );
}

function RelatedGameRow({
  game,
  onOpen,
  onOpenPerson,
}: {
  game: CharacterGameAppearance;
  onOpen: (game: CharacterGameAppearance, avatarEl: HTMLElement | null) => void;
  onOpenPerson?: (
    personId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const showOriginalName = useShowOriginalName();
  const { title, subtitle } = resolveGameListNames(game, showOriginalName);
  const relation = game.relation?.trim() ?? "";
  const actors = (game.actors ?? []).filter((actor) => actor?.id && actor.name);

  return (
    <li className="entity-related-item entity-appearance-item">
      <div className="entity-appearance-main-col">
        <Tile
          className="entity-appearance-main"
          plain
          title={title}
          lines={[subtitle, relation]}
          imageUrl={game.image}
          imageShape="cover"
          imageSide="left"
          mediaRef={mediaRef}
          onClick={() => onOpen(game, mediaRef.current)}
        />
      </div>

      {actors.length > 0 ? (
        <div className="entity-appearance-side-col">
          {actors.map((actor) => (
            <AppearanceActorButton
              key={actor.id}
              actor={actor}
              onOpenPerson={onOpenPerson}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}

function RelatedPerformanceRow({
  appearance,
  onOpenCharacter,
  onOpenGame,
}: {
  appearance: PersonCharacterAppearance;
  onOpenCharacter: (
    appearance: PersonCharacterAppearance,
    avatarEl: HTMLElement | null,
  ) => void;
  onOpenGame: (
    game: PersonCharacterGame,
    coverEl: HTMLElement | null,
  ) => void;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const showOriginalName = useShowOriginalName();
  const imageUrl = useCachedEntityImage({
    kind: "character",
    id: appearance.id,
    images: appearance.images,
  });
  const { title, subtitle } = resolveGameListNames(
    { name: appearance.name, nameCn: appearance.nameCn ?? "" },
    showOriginalName,
  );
  const relation = appearance.relation?.trim() ?? "";
  const games = appearance.games ?? [];

  return (
    <li className="entity-related-item entity-appearance-item">
      <div className="entity-appearance-main-col">
        <Tile
          className="entity-appearance-main"
          plain
          title={title}
          lines={[subtitle, relation]}
          imageUrl={imageUrl}
          imageShape="circle"
          imageSide="left"
          mediaRef={mediaRef}
          onClick={() => onOpenCharacter(appearance, mediaRef.current)}
        />
      </div>

      {games.length > 0 ? (
        <div className="entity-appearance-side-col">
          {games.map((game) => (
            <AppearanceGameTile
              key={game.id}
              game={game}
              onOpenGame={onOpenGame}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}

function AppearanceGameTile({
  game,
  onOpenGame,
}: {
  game: PersonCharacterGame;
  onOpenGame: (
    game: PersonCharacterGame,
    coverEl: HTMLElement | null,
  ) => void;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const showOriginalName = useShowOriginalName();
  const { title, subtitle } = resolveGameListNames(game, showOriginalName);
  const relation = game.relation?.trim() ?? "";

  return (
    <Tile
      className="entity-appearance-actor"
      plain
      title={title}
      lines={[subtitle, relation]}
      imageUrl={game.image}
      imageShape="cover"
      imageSide="right"
      mediaRef={mediaRef}
      onClick={() => onOpenGame(game, mediaRef.current)}
    />
  );
}

function RelatedParticipationRow({
  item,
  onOpen,
}: {
  item: PersonGameParticipation;
  onOpen: (
    item: PersonGameParticipation,
    coverEl: HTMLElement | null,
  ) => void;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const showOriginalName = useShowOriginalName();
  const { title, subtitle } = resolveGameListNames(item, showOriginalName);
  const relations = (item.relations ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <li>
      <button
        type="button"
        className="entity-related-item entity-participation-item"
        onClick={() => onOpen(item, mediaRef.current)}
      >
        <div ref={mediaRef} className="entity-participation-cover">
          {item.image ? (
            <img src={item.image} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="entity-participation-cover-empty" aria-hidden />
          )}
        </div>
        <div className="entity-participation-meta">
          <p className="entity-participation-title" title={title}>
            {title}
          </p>
          {subtitle ? (
            <p className="entity-participation-subtitle" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {relations.length > 0 ? (
          <div className="entity-participation-tags" aria-label="职位">
            {relations.map((relation) => (
              <span key={relation} className="entity-participation-tag">
                {relation}
              </span>
            ))}
          </div>
        ) : null}
      </button>
    </li>
  );
}
