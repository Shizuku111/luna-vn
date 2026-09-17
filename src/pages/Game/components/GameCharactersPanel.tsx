import { useEffect, useMemo, useRef, useState } from "react";
import type { DetailOpenOrigin } from "@/components/DetailOverlay";
import { Tile } from "@/components/Tile";
import {
  compareCharacterRelationLabels,
  listLibraryGameCharacters,
  type LibraryCharacter,
} from "@/features/character";
import { useCachedEntityImage } from "@/features/entityImage";
import { toErrorMessage } from "@/utils/errorMessage";
import "./GameDetailGroups.css";

type GameCharactersPanelProps = {
  gameId: number;
  refreshToken?: number;
  onOpenCharacter?: (
    characterId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
};

type CharacterRelationGroup = {
  relation: string;
  characters: LibraryCharacter[];
};

function resolveActorsLabel(character: LibraryCharacter) {
  const names = (character.actors ?? [])
    .map((actor) => actor.name?.trim())
    .filter(Boolean);
  return names.length > 0 ? names.join("、") : "";
}

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

function groupCharactersByRelation(
  characters: LibraryCharacter[],
): CharacterRelationGroup[] {
  const groups = new Map<string, LibraryCharacter[]>();
  for (const character of characters) {
    const key = character.relation?.trim() ?? "";
    const list = groups.get(key) ?? [];
    list.push(character);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => compareCharacterRelationLabels(a, b))
    .map(([relation, items]) => ({
      relation,
      characters: items,
    }));
}

export function GameCharactersPanel({
  gameId,
  refreshToken = 0,
  onOpenCharacter,
}: GameCharactersPanelProps) {
  const [characters, setCharacters] = useState<LibraryCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await listLibraryGameCharacters(gameId);
        if (cancelled) return;
        setCharacters(next);
      } catch (err) {
        if (cancelled) return;
        setCharacters([]);
        setError(toErrorMessage(err, "加载角色失败"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, refreshToken]);

  const groups = useMemo(
    () => groupCharactersByRelation(characters),
    [characters],
  );

  if (loading) {
    return <p className="game-page-tab-empty">加载角色中…</p>;
  }

  if (error) {
    return <p className="game-page-tab-empty">{error}</p>;
  }

  if (characters.length === 0) {
    return <p className="game-page-tab-empty">暂无角色信息</p>;
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
            {group.characters.map((character) => (
              <CharacterTile
                key={character.id}
                character={character}
                showRelation={!group.relation}
                onOpenCharacter={onOpenCharacter}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CharacterTile({
  character,
  showRelation,
  onOpenCharacter,
}: {
  character: LibraryCharacter;
  showRelation: boolean;
  onOpenCharacter?: (
    characterId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const imageUrl = useCachedEntityImage({
    kind: "character",
    id: character.id,
    images: character.images,
  });
  const actors = resolveActorsLabel(character);
  const relation = showRelation ? (character.relation?.trim() ?? "") : "";

  return (
    <li>
      <Tile
        title={character.name}
        lines={[relation, actors ? `CV：${actors}` : null]}
        imageUrl={imageUrl}
        imageShape="circle"
        mediaRef={mediaRef}
        onClick={
          onOpenCharacter
            ? () =>
                onOpenCharacter(
                  character.id,
                  getOpenOrigin(mediaRef.current) ?? null,
                )
            : undefined
        }
      />
    </li>
  );
}
