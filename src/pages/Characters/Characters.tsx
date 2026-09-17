import { useMemo, useState, type ChangeEvent } from "react";
import { DialogConfirm } from "@/components/Dialog";
import { MessagePlugin } from "@/components/Message";
import {
  listLibraryCharacters,
  deleteCharacter,
  markCharacterFavorite,
  type LibraryCharacter,
} from "@/features/character";
import { useEntityListState } from "@/hooks/useEntityListState";
import { toErrorMessage } from "@/utils/errorMessage";
import { EntityListPage } from "@/pages/shared/EntityListPage";
import {
  ENTITY_LIST_SORT_OPTIONS,
  buildEntityListEmptyMessage,
  compareEntitiesBySort,
  matchesEntityQuery,
  type EntityListSortValue,
} from "@/pages/shared/entityListUtils";
import { CharacterCard } from "./components/CharacterCard";

const ENTITY_LABEL = "角色";

export function CharactersPage({
  onOpenCharacter,
  refreshToken = 0,
}: {
  onOpenCharacter?: (
    characterId: number,
    origin?: {
      left: number;
      top: number;
      width: number;
      height: number;
    } | null,
  ) => void;
  refreshToken?: number;
}) {
  const { items: characters, setItems: setCharacters, loading } =
    useEntityListState<LibraryCharacter>({
      refreshToken,
      load: listLibraryCharacters,
      loadErrorMessage: "加载角色失败",
    });
  const [sortBy, setSortBy] = useState<EntityListSortValue>("added");
  const [ascending, setAscending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const visibleCharacters = useMemo(
    () =>
      [...characters]
        .filter((character) => !favoritesOnly || character.favorite)
        .filter((character) => matchesEntityQuery(character, searchQuery))
        .sort((a, b) => compareEntitiesBySort(a, b, sortBy, ascending)),
    [characters, searchQuery, sortBy, ascending, favoritesOnly],
  );

  function handleOpenCharacter(
    character: LibraryCharacter,
    origin?: {
      left: number;
      top: number;
      width: number;
      height: number;
    },
  ) {
    onOpenCharacter?.(character.id, origin ?? null);
  }

  function handleFavoriteChange(
    target: LibraryCharacter,
    favorite: boolean,
  ) {
    void (async () => {
      if (!favorite) {
        const ok = await DialogConfirm({
          title: "取消喜欢",
          content: `确定取消「${target.name}」的喜欢吗？`,
          confirmText: "取消喜欢",
        });
        if (!ok) return;
      }

      try {
        const updated = await markCharacterFavorite(target, favorite);
        setCharacters((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
        MessagePlugin.success(favorite ? "已设为喜欢" : "已取消喜欢");
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "更新喜欢失败"));
      }
    })();
  }

  function handleDeleteCharacter(target: LibraryCharacter) {
    void (async () => {
      const ok = await DialogConfirm({
        title: "删除角色",
        content: `确定删除「${target.name}」吗？此操作不可恢复。`,
        confirmText: "删除",
        confirmTheme: "danger",
      });
      if (!ok) return;

      try {
        await deleteCharacter(target);
        MessagePlugin.success("已删除角色");
        setCharacters((list) => list.filter((item) => item.id !== target.id));
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "删除失败"));
      }
    })();
  }

  return (
    <EntityListPage
      entityLabel={ENTITY_LABEL}
      sortOptions={ENTITY_LIST_SORT_OPTIONS}
      sortBy={sortBy}
      onSortByChange={(value) => setSortBy(value as EntityListSortValue)}
      ascending={ascending}
      onToggleSortDirection={() => setAscending((value) => !value)}
      favoritesOnly={favoritesOnly}
      onToggleFavoritesOnly={() => setFavoritesOnly((value) => !value)}
      searchQuery={searchQuery}
      onSearchChange={(event: ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
      }}
      visibleCount={visibleCharacters.length}
      loading={loading}
      items={visibleCharacters}
      emptyMessage={buildEntityListEmptyMessage(
        ENTITY_LABEL,
        favoritesOnly,
        searchQuery,
        "暂无角色，添加游戏后会自动同步。",
      )}
      getItemKey={(character) => character.id}
      resetScrollKey={`${searchQuery}\0${sortBy}\0${ascending}\0${favoritesOnly}`}
      renderItem={(character) => (
        <CharacterCard
          character={character}
          onOpen={handleOpenCharacter}
          onDelete={handleDeleteCharacter}
          onFavoriteChange={handleFavoriteChange}
        />
      )}
    />
  );
}
