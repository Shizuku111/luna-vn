import { useMemo, useState, type ChangeEvent } from "react";
import { DialogConfirm } from "@/components/Dialog";
import { MessagePlugin } from "@/components/Message";
import { Select } from "@/components/Select";
import {
  listLibraryPersons,
  deletePerson,
  markPersonFavorite,
  type LibraryPerson,
} from "@/features/person";
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
import { PersonCard } from "./components/PersonCard";

const ENTITY_LABEL = "人物";

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "全部类型" },
  { value: "1", label: "个人" },
  { value: "2", label: "公司" },
  { value: "3", label: "组合" },
] as const;

type TypeFilterValue = (typeof TYPE_FILTER_OPTIONS)[number]["value"];

export function PersonsPage({
  onOpenPerson,
  refreshToken = 0,
}: {
  onOpenPerson?: (
    personId: number,
    origin?: {
      left: number;
      top: number;
      width: number;
      height: number;
    } | null,
  ) => void;
  refreshToken?: number;
}) {
  const { items: persons, setItems: setPersons, loading } =
    useEntityListState<LibraryPerson>({
      refreshToken,
      load: listLibraryPersons,
      loadErrorMessage: "加载人物失败",
    });
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>("all");
  const [sortBy, setSortBy] = useState<EntityListSortValue>("added");
  const [ascending, setAscending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const visiblePersons = useMemo(() => {
    const filtered =
      typeFilter === "all"
        ? persons
        : persons.filter((person) => person.type === Number(typeFilter));

    return [...filtered]
      .filter((person) => !favoritesOnly || person.favorite)
      .filter((person) => matchesEntityQuery(person, searchQuery))
      .sort((a, b) => compareEntitiesBySort(a, b, sortBy, ascending));
  }, [persons, typeFilter, searchQuery, sortBy, ascending, favoritesOnly]);

  function handleOpenPerson(
    person: LibraryPerson,
    origin?: {
      left: number;
      top: number;
      width: number;
      height: number;
    },
  ) {
    onOpenPerson?.(person.id, origin ?? null);
  }

  function handleFavoriteChange(target: LibraryPerson, favorite: boolean) {
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
        const updated = await markPersonFavorite(target, favorite);
        setPersons((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
        MessagePlugin.success(favorite ? "已设为喜欢" : "已取消喜欢");
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "更新喜欢失败"));
      }
    })();
  }

  function handleDeletePerson(target: LibraryPerson) {
    void (async () => {
      const ok = await DialogConfirm({
        title: "删除人物",
        content: `确定删除「${target.name}」吗？此操作不可恢复。`,
        confirmText: "删除",
        confirmTheme: "danger",
      });
      if (!ok) return;

      try {
        await deletePerson(target);
        MessagePlugin.success("已删除人物");
        setPersons((list) => list.filter((item) => item.id !== target.id));
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "删除失败"));
      }
    })();
  }

  return (
    <EntityListPage
      entityLabel={ENTITY_LABEL}
      toolbarLeftExtra={
        <Select
          title="类型"
          value={typeFilter}
          options={[...TYPE_FILTER_OPTIONS]}
          onChange={setTypeFilter}
        />
      }
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
      visibleCount={visiblePersons.length}
      loading={loading}
      items={visiblePersons}
      emptyMessage={buildEntityListEmptyMessage(
        ENTITY_LABEL,
        favoritesOnly,
        searchQuery,
        "暂无人物，添加游戏后会自动同步。",
      )}
      getItemKey={(person) => person.id}
      resetScrollKey={`${typeFilter}\0${searchQuery}\0${sortBy}\0${ascending}\0${favoritesOnly}`}
      renderItem={(person) => (
        <PersonCard
          person={person}
          onOpen={handleOpenPerson}
          onDelete={handleDeletePerson}
          onFavoriteChange={handleFavoriteChange}
        />
      )}
    />
  );
}
