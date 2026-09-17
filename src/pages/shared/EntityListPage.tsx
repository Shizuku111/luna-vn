import type { ChangeEvent, Key, ReactNode } from "react";
import { HeartIcon, SearchIcon, SortAscIcon, SortDescIcon } from "@/components/icons";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { VirtualCardGrid } from "@/components/VirtualCardGrid";

export type EntityListSortOption = {
  value: string;
  label: string;
};

export type EntityListPageProps<T> = {
  toolbarLeftExtra?: ReactNode;
  sortOptions: readonly EntityListSortOption[] | EntityListSortOption[];
  sortBy: string;
  onSortByChange: (value: string) => void;
  ascending: boolean;
  onToggleSortDirection: () => void;
  favoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  entityLabel: string;
  searchQuery: string;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  visibleCount: number;
  loading: boolean;
  items: T[];
  emptyMessage: string;
  getItemKey: (item: T) => Key;
  resetScrollKey: string;
  renderItem: (item: T) => ReactNode;
};

export function EntityListPage<T>({
  toolbarLeftExtra,
  sortOptions,
  sortBy,
  onSortByChange,
  ascending,
  onToggleSortDirection,
  favoritesOnly,
  onToggleFavoritesOnly,
  entityLabel,
  searchQuery,
  onSearchChange,
  visibleCount,
  loading,
  items,
  emptyMessage,
  getItemKey,
  resetScrollKey,
  renderItem,
}: EntityListPageProps<T>) {
  return (
    <section className="list-page">
      <header className="list-toolbar page-sticky-toolbar">
        <div className="list-toolbar-left">
          {toolbarLeftExtra}

          <Select
            title="排序"
            value={sortBy}
            options={[...sortOptions]}
            onChange={onSortByChange}
          />

          <Button
            className="list-toolbar-left-btn"
            icon
            aria-label={ascending ? "切换为倒序" : "切换为正序"}
            onClick={onToggleSortDirection}
            content={
              ascending ? (
                <SortAscIcon aria-hidden />
              ) : (
                <SortDescIcon aria-hidden />
              )
            }
          />
          <Button
            className={[
              "list-toolbar-left-btn",
              "favorite-filter-btn",
              favoritesOnly ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={
              favoritesOnly ? `显示全部${entityLabel}` : "只显示喜欢"
            }
            aria-pressed={favoritesOnly}
            onClick={onToggleFavoritesOnly}
            prefix={
              <HeartIcon
                aria-hidden
                className={
                  favoritesOnly
                    ? "library-favorite-icon is-favorite"
                    : "library-favorite-icon"
                }
              />
            }
            content="只显示喜欢"
          />
          {visibleCount > 0 ? (
            <span className="list-count-meta" aria-live="polite">
              共 {visibleCount} 项
            </span>
          ) : null}
        </div>

        <div className="list-toolbar-right">
          <Input
            type="search"
            className="list-search"
            prefix={<SearchIcon aria-hidden />}
            clearable
            placeholder={`搜索${entityLabel}`}
            aria-label={`搜索${entityLabel}`}
            value={searchQuery}
            onChange={onSearchChange}
          />
        </div>
      </header>

      <div className="list-body">
        {loading ? (
          <p className="list-empty">加载中…</p>
        ) : items.length === 0 ? (
          <p className="list-empty">{emptyMessage}</p>
        ) : (
          <VirtualCardGrid
            className="list-grid"
            items={items}
            getItemKey={getItemKey}
            columns={3}
            rowGap={28}
            measureRows={false}
            estimateRowHeight={108}
            resetScrollKey={resetScrollKey}
            renderItem={renderItem}
          />
        )}
      </div>
    </section>
  );
}
