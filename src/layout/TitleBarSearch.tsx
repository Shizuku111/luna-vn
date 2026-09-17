import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { SearchIcon } from "@/components/icons";
import { Input } from "@/components/Input";
import { listLibraryCharacters } from "@/features/character";
import {
  useLibraryGames,
  type LibraryGame,
} from "@/features/library";
import { listLibraryPersons } from "@/features/person";
import {
  collectEntityNameTexts,
  matchesNameQuery,
  pickDisplayAltName,
} from "@/features/search";
import "./TitleBarSearch.css";

export type TitleBarSearchProps = {
  revision?: number | string;
  onOpenGame?: (gameId: number) => void;
  onOpenCharacter?: (characterId: number) => void;
  onOpenPerson?: (personId: number) => void;
};

type SearchKind = "game" | "character" | "person";

type SearchHit = {
  key: string;
  kind: SearchKind;
  id: number;
  name: string;
  altName: string | null;
  image: string | null;
};

type SearchIndexItem = SearchHit & {
  texts: string[];
};

const KIND_LABEL: Record<SearchKind, string> = {
  game: "游戏",
  character: "角色",
  person: "人物",
};

const MAX_RESULTS_PER_KIND = 5;

function pickImage(
  images?: {
    grid?: string;
    small?: string;
    medium?: string;
    large?: string;
    common?: string;
  } | null,
) {
  if (!images) return null;
  return (
    images.grid ||
    images.small ||
    images.medium ||
    images.common ||
    images.large ||
    null
  );
}

function buildGameSearchItems(games: LibraryGame[]): SearchIndexItem[] {
  const items: SearchIndexItem[] = [];
  for (const game of games) {
    const texts = collectEntityNameTexts({
      name: game.name,
      nameCn: game.nameCn,
      infobox: game.infobox,
    });
    items.push({
      key: `game-${game.id}`,
      kind: "game",
      id: game.id,
      name: game.name.trim() || game.nameCn.trim() || String(game.id),
      altName: pickDisplayAltName(
        game.name.trim() || game.nameCn.trim(),
        texts,
      ),
      image: pickImage(game.images) || game.image || null,
      texts,
    });
  }
  return items;
}

async function buildEntitySearchItems(): Promise<SearchIndexItem[]> {
  const [characters, persons] = await Promise.all([
    listLibraryCharacters(),
    listLibraryPersons(),
  ]);

  const items: SearchIndexItem[] = [];

  for (const character of characters) {
    const texts = collectEntityNameTexts({
      name: character.name,
      infobox: character.infobox,
    });
    items.push({
      key: `character-${character.id}`,
      kind: "character",
      id: character.id,
      name: character.name.trim() || String(character.id),
      altName: pickDisplayAltName(character.name, texts),
      image: pickImage(character.images),
      texts,
    });
  }

  for (const person of persons) {
    const texts = collectEntityNameTexts({
      name: person.name,
      infobox: person.infobox,
    });
    items.push({
      key: `person-${person.id}`,
      kind: "person",
      id: person.id,
      name: person.name.trim() || String(person.id),
      altName: pickDisplayAltName(person.name, texts),
      image: pickImage(person.images),
      texts,
    });
  }

  return items;
}

export function TitleBarSearch({
  revision = 0,
  onOpenGame,
  onOpenCharacter,
  onOpenPerson,
}: TitleBarSearchProps) {
  const { games } = useLibraryGames();
  const gamesRef = useRef(games);
  gamesRef.current = games;

  const rootRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef<SearchIndexItem[] | null>(null);
  const indexDirtyRef = useRef(false);
  const dirtyTokenRef = useRef(0);
  const loadPromiseRef = useRef<Promise<SearchIndexItem[]> | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    indexDirtyRef.current = true;
    dirtyTokenRef.current += 1;
  }, [revision]);

  const mergeIndex = useCallback((entityItems: SearchIndexItem[]) => {
    const items = [
      ...buildGameSearchItems(gamesRef.current),
      ...entityItems,
    ];
    indexRef.current = items;
    return items;
  }, []);

  const ensureIndex = useCallback(async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (indexRef.current && !indexDirtyRef.current) {
        const entityItems = indexRef.current.filter(
          (item) => item.kind !== "game",
        );
        return mergeIndex(entityItems);
      }

      if (loadPromiseRef.current) {
        await loadPromiseRef.current;
        if (indexRef.current && !indexDirtyRef.current) {
          const entityItems = indexRef.current.filter(
            (item) => item.kind !== "game",
          );
          return mergeIndex(entityItems);
        }
      }

      const tokenAtStart = dirtyTokenRef.current;
      setLoading(true);
      const promise = buildEntitySearchItems()
        .then((entityItems) => {
          const items = mergeIndex(entityItems);
          if (dirtyTokenRef.current === tokenAtStart) {
            indexDirtyRef.current = false;
          }
          return items;
        })
        .finally(() => {
          if (loadPromiseRef.current === promise) {
            setLoading(false);
            loadPromiseRef.current = null;
          }
        });
      loadPromiseRef.current = promise;
      await promise;
    }

    return indexRef.current ?? [];
  }, [mergeIndex]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setActiveIndex(0);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const index = await ensureIndex();
        if (cancelled) return;
        const next: SearchHit[] = [];
        for (const kind of ["game", "character", "person"] as const) {
          const kindHits = index
            .filter(
              (item) =>
                item.kind === kind && matchesNameQuery(item.texts, trimmed),
            )
            .slice(0, MAX_RESULTS_PER_KIND)
            .map(({ texts: _texts, ...hit }) => hit);
          next.push(...kindHits);
        }
        setHits(next);
        setActiveIndex(0);
      })();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, ensureIndex, revision]);

  useEffect(() => {
    if (!open) return;

    function dismissSearch() {
      setOpen(false);
      const input = rootRef.current?.querySelector("input");
      if (input instanceof HTMLInputElement) {
        input.blur();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      dismissSearch();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") dismissSearch();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const grouped = useMemo(() => {
    const groups: { kind: SearchKind; items: SearchHit[] }[] = [];
    for (const kind of ["game", "character", "person"] as const) {
      const items = hits.filter((hit) => hit.kind === kind);
      if (items.length > 0) groups.push({ kind, items });
    }
    return groups;
  }, [hits]);

  const showPanel = open && query.trim().length > 0;

  function openHit(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    setHits([]);
    const input = rootRef.current?.querySelector("input");
    if (input instanceof HTMLInputElement) {
      input.blur();
    }
    if (hit.kind === "game") onOpenGame?.(hit.id);
    else if (hit.kind === "character") onOpenCharacter?.(hit.id);
    else onOpenPerson?.(hit.id);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setOpen(true);
  }

  function handleFocus() {
    setOpen(true);
    indexRef.current = null;
    loadPromiseRef.current = null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showPanel) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (hits.length === 0) return;
      setActiveIndex((index) => (index + 1) % hits.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (hits.length === 0) return;
      setActiveIndex((index) => (index - 1 + hits.length) % hits.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = hits[activeIndex];
      if (hit) openHit(hit);
    }
  }

  let flatOffset = 0;

  return (
    <div className="titlebar-search-wrap" ref={rootRef}>
      <Input
        size="medium"
        type="search"
        className="titlebar-search"
        prefix={<SearchIcon aria-hidden />}
        clearable
        placeholder="搜索"
        aria-label="搜索"
        aria-expanded={showPanel}
        aria-controls="titlebar-search-results"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      />

      {showPanel ? (
        <div
          id="titlebar-search-results"
          className="titlebar-search-results"
          role="listbox"
        >
          {loading && hits.length === 0 ? (
            <p className="titlebar-search-empty">搜索中…</p>
          ) : hits.length === 0 ? (
            <p className="titlebar-search-empty">未找到匹配结果</p>
          ) : (
            grouped.map((group) => {
              const section = (
                <div key={group.kind} className="titlebar-search-group">
                  <p className="titlebar-search-group-label">
                    {KIND_LABEL[group.kind]}
                  </p>
                  <ul className="titlebar-search-list">
                    {group.items.map((hit, indexInGroup) => {
                      const flatIndex = flatOffset + indexInGroup;
                      return (
                        <li key={hit.key}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={flatIndex === activeIndex}
                            className={[
                              "titlebar-search-item",
                              flatIndex === activeIndex ? "is-active" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onMouseEnter={() => setActiveIndex(flatIndex)}
                            onClick={() => openHit(hit)}
                          >
                            <span
                              className={[
                                "titlebar-search-avatar",
                                hit.kind === "game" ? "is-cover" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              {hit.image ? (
                                <img
                                  src={hit.image}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span
                                  className="titlebar-search-avatar-empty"
                                  aria-hidden
                                />
                              )}
                            </span>
                            <span className="titlebar-search-meta">
                              <span className="titlebar-search-name" title={hit.name}>
                                {hit.name}
                              </span>
                              {hit.altName ? (
                                <span
                                  className="titlebar-search-alt"
                                  title={hit.altName}
                                >
                                  {hit.altName}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
              flatOffset += group.items.length;
              return section;
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
