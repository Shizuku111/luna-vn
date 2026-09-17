import { useEffect, useMemo, useRef, useState } from "react";
import type { DetailOpenOrigin } from "@/components/DetailOverlay";
import { Tile } from "@/components/Tile";
import {
  listLibraryGameRelations,
  resolveGameCoverUrl,
  resolveGameListNames,
  type LibraryGame,
  type LibraryGameRelation,
} from "@/features/library";
import { useShowOriginalName } from "@/features/settings";
import { toErrorMessage } from "@/utils/errorMessage";
import "./GameDetailGroups.css";

type GameRelatedPanelProps = {
  gameId: number;
  refreshToken?: number;
  onOpenGame?: (gameId: number, origin?: DetailOpenOrigin | null) => void;
};

type RelatedRelationGroup = {
  relation: string;
  items: LibraryGameRelation[];
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

function groupRelationsByLabel(
  relations: LibraryGameRelation[],
): RelatedRelationGroup[] {
  const groups = new Map<string, LibraryGameRelation[]>();
  for (const item of relations) {
    const key = item.relation?.trim() ?? "";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([relation, items]) => ({
    relation,
    items,
  }));
}

export function GameRelatedPanel({
  gameId,
  refreshToken = 0,
  onOpenGame,
}: GameRelatedPanelProps) {
  const [relations, setRelations] = useState<LibraryGameRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await listLibraryGameRelations(gameId);
        if (cancelled) return;
        setRelations(next);
      } catch (err) {
        if (cancelled) return;
        setRelations([]);
        setError(toErrorMessage(err, "加载关联游戏失败"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, refreshToken]);

  const groups = useMemo(() => groupRelationsByLabel(relations), [relations]);

  if (loading) {
    return <p className="game-page-tab-empty">加载关联中…</p>;
  }

  if (error) {
    return <p className="game-page-tab-empty">{error}</p>;
  }

  if (relations.length === 0) {
    return <p className="game-page-tab-empty">暂无关联游戏</p>;
  }

  return (
    <div className="game-detail-groups">
      {groups.map((group) => (
        <section
          key={group.relation || "__empty"}
          className="game-detail-group"
        >
          {group.relation ? (
            <h3 className="game-detail-group-label">{group.relation}</h3>
          ) : null}
          <ul className="game-detail-tile-list">
            {group.items.map((item) => (
              <RelatedGameTile
                key={item.relatedGameId}
                relation={item}
                showRelation={!group.relation}
                onOpenGame={onOpenGame}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function RelatedGameTile({
  relation,
  showRelation,
  onOpenGame,
}: {
  relation: LibraryGameRelation;
  showRelation: boolean;
  onOpenGame?: (gameId: number, origin?: DetailOpenOrigin | null) => void;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const showOriginalName = useShowOriginalName();
  const game: LibraryGame = relation.game;
  const coverUrl = resolveGameCoverUrl(game, "list");
  const { title, subtitle } = resolveGameListNames(game, showOriginalName);
  const relationLabel = showRelation ? (relation.relation?.trim() ?? "") : "";

  return (
    <li>
      <Tile
        title={title}
        lines={[subtitle, relationLabel]}
        imageUrl={coverUrl}
        imageShape="cover"
        mediaRef={mediaRef}
        onClick={
          onOpenGame
            ? () =>
                onOpenGame(game.id, getOpenOrigin(mediaRef.current) ?? null)
            : undefined
        }
      />
    </li>
  );
}
