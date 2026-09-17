import { useEffect, useMemo, useRef, useState } from "react";
import type { DetailOpenOrigin } from "@/components/DetailOverlay";
import { Tile } from "@/components/Tile";
import { useCachedEntityImage } from "@/features/entityImage";
import {
  comparePersonRelationLabels,
  formatPersonRelations,
  listLibraryGamePersons,
  parsePersonRelations,
  type LibraryGamePerson,
} from "@/features/person";
import { toErrorMessage } from "@/utils/errorMessage";
import "./GameDetailGroups.css";

type GamePersonsPanelProps = {
  gameId: number;
  refreshToken?: number;
  onOpenPerson?: (
    personId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
};

const PERSON_TYPE_LABEL: Record<number, string> = {
  1: "个人",
  2: "公司",
  3: "组合",
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

type PersonRelationGroup = {
  relation: string;
  persons: LibraryGamePerson[];
};

function groupPersonsByRelation(
  persons: LibraryGamePerson[],
): PersonRelationGroup[] {
  const groups = new Map<string, LibraryGamePerson[]>();
  for (const person of persons) {
    const relations = parsePersonRelations(person.relation);
    const keys = relations.length > 0 ? relations : [""];
    for (const key of keys) {
      const list = groups.get(key) ?? [];
      if (!list.some((item) => item.id === person.id)) {
        list.push(person);
      }
      groups.set(key, list);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => comparePersonRelationLabels(a, b))
    .map(([relation, items]) => ({
      relation,
      persons: items,
    }));
}

export function GamePersonsPanel({
  gameId,
  refreshToken = 0,
  onOpenPerson,
}: GamePersonsPanelProps) {
  const [persons, setPersons] = useState<LibraryGamePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await listLibraryGamePersons(gameId);
        if (cancelled) return;
        setPersons(next);
      } catch (err) {
        if (cancelled) return;
        setPersons([]);
        setError(toErrorMessage(err, "加载相关人员失败"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, refreshToken]);

  const groups = useMemo(() => groupPersonsByRelation(persons), [persons]);

  if (loading) {
    return <p className="game-page-tab-empty">加载相关人员中…</p>;
  }

  if (error) {
    return <p className="game-page-tab-empty">{error}</p>;
  }

  if (persons.length === 0) {
    return <p className="game-page-tab-empty">暂无相关人员信息</p>;
  }

  return (
    <div className="game-detail-groups">
      {groups.map((group) => {
        const label = group.relation || "其他";
        return (
          <section key={group.relation || "__empty"} className="game-detail-group">
            <h3 className="game-detail-group-label">{label}</h3>
            <ul className="game-detail-tile-list">
              {group.persons.map((person) => (
                <PersonTile
                  key={`${group.relation}:${person.id}`}
                  person={person}
                  groupRelation={group.relation}
                  onOpenPerson={onOpenPerson}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PersonTile({
  person,
  groupRelation,
  onOpenPerson,
}: {
  person: LibraryGamePerson;
  groupRelation: string;
  onOpenPerson?: (
    personId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
}) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const imageUrl = useCachedEntityImage({
    kind: "person",
    id: person.id,
    images: person.images,
  });
  const otherRelations = parsePersonRelations(person.relation)
    .filter((item) => item !== groupRelation)
    .join("、");
  const relationLabel =
    otherRelations ||
    (!groupRelation ? formatPersonRelations(person.relation) : "");
  const typeLabel = PERSON_TYPE_LABEL[person.type] ?? "";

  return (
    <li>
      <Tile
        title={person.name}
        lines={[relationLabel, typeLabel]}
        imageUrl={imageUrl}
        imageShape="circle"
        mediaRef={mediaRef}
        onClick={
          onOpenPerson
            ? () =>
                onOpenPerson(person.id, getOpenOrigin(mediaRef.current) ?? null)
            : undefined
        }
      />
    </li>
  );
}
