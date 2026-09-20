import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Key,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import "./VirtualCardGrid.css";

const DEFAULT_MIN_COLUMN_WIDTH = 260;
const DEFAULT_COLUMN_GAP = 20;
const DEFAULT_ROW_GAP = 16;
const DEFAULT_ROW_HEIGHT = 84;
const SCROLL_PARENT_SELECTOR = ".app-content-body";

export type VirtualCardGridProps<T> = {
  items: T[];
  getItemKey: (item: T) => Key;
  renderItem: (item: T) => ReactNode;
  className?: string;
  resetScrollKey?: string | number;
  columns?: number;
  minColumnWidth?: number;
  columnGap?: number;
  rowGap?: number;
  estimateRowHeight?: number | ((columnWidth: number) => number);
  overscan?: number;
  measureRows?: boolean;
  onVisibleItemsChange?: (items: T[]) => void;
};

function computeColumnCount(
  width: number,
  minColumnWidth: number,
  columnGap: number,
) {
  if (width <= 0) return 1;
  return Math.max(
    1,
    Math.floor((width + columnGap) / (minColumnWidth + columnGap)),
  );
}

function resolveEstimateRowHeight(
  estimateRowHeight: number | ((columnWidth: number) => number),
  width: number,
  columns: number,
  columnGap: number,
) {
  if (typeof estimateRowHeight === "number") return estimateRowHeight;
  const columnWidth =
    columns > 0
      ? Math.max(0, (width - columnGap * (columns - 1)) / columns)
      : 0;
  return estimateRowHeight(columnWidth);
}

export function VirtualCardGrid<T>({
  items,
  getItemKey,
  renderItem,
  className,
  resetScrollKey,
  columns: fixedColumns,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
  columnGap = DEFAULT_COLUMN_GAP,
  rowGap = DEFAULT_ROW_GAP,
  estimateRowHeight = DEFAULT_ROW_HEIGHT,
  overscan = 4,
  measureRows = true,
  onVisibleItemsChange,
}: VirtualCardGridProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const scroll = list.closest(SCROLL_PARENT_SELECTOR) as HTMLElement | null;
    setScrollElement(scroll);

    const updateMetrics = () => {
      setWidth(list.clientWidth);
      if (!scroll) {
        setScrollMargin(0);
        return;
      }
      const listRect = list.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      setScrollMargin(listRect.top - scrollRect.top + scroll.scrollTop);
    };

    updateMetrics();

    const observer = new ResizeObserver(updateMetrics);
    observer.observe(list);
    if (scroll) observer.observe(scroll);
    window.addEventListener("resize", updateMetrics);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, []);

  const columns =
    fixedColumns != null && fixedColumns > 0
      ? fixedColumns
      : computeColumnCount(width, minColumnWidth, columnGap);
  const rowCount = columns > 0 ? Math.ceil(items.length / columns) : 0;
  const contentHeight = resolveEstimateRowHeight(
    estimateRowHeight,
    width,
    columns,
    columnGap,
  );
  const estimateSize = contentHeight + rowGap;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateSize,
    measureElement: measureRows
      ? (element) => element.getBoundingClientRect().height
      : undefined,
    overscan,
    scrollMargin,
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, columns, estimateSize, items.length, width]);

  useLayoutEffect(() => {
    scrollElement?.scrollTo({ top: 0 });
  }, [resetScrollKey, columns, scrollElement]);

  const virtualItems = virtualizer.getVirtualItems();
  const visibleItems = useMemo(() => {
    const next: T[] = [];
    for (const virtualRow of virtualItems) {
      const start = virtualRow.index * columns;
      next.push(...items.slice(start, start + columns));
    }
    return next;
  }, [virtualItems, columns, items]);

  const lastVisibleKeyRef = useRef("");
  const onVisibleItemsChangeRef = useRef(onVisibleItemsChange);
  onVisibleItemsChangeRef.current = onVisibleItemsChange;

  useEffect(() => {
    const visibleKey = visibleItems
      .map((item) => String(getItemKey(item)))
      .join("\0");
    if (visibleKey === lastVisibleKeyRef.current) return;
    lastVisibleKeyRef.current = visibleKey;
    onVisibleItemsChangeRef.current?.(visibleItems);
  }, [visibleItems, getItemKey]);

  return (
    <div
      ref={listRef}
      className={["virtual-card-grid", className].filter(Boolean).join(" ")}
      style={{ height: Math.max(virtualizer.getTotalSize(), estimateSize) }}
    >
      {virtualItems.map((virtualRow) => {
        const start = virtualRow.index * columns;
        const rowItems = items.slice(start, start + columns);
        const style: CSSProperties = {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translate3d(0, ${virtualRow.start - scrollMargin}px, 0)`,
          contain: "layout style",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          columnGap,
          paddingBottom: rowGap,
          boxSizing: "border-box",
          ...(measureRows ? null : { height: estimateSize }),
        };

        return (
          <ul
            key={virtualRow.key}
            ref={measureRows ? virtualizer.measureElement : undefined}
            data-index={virtualRow.index}
            className="virtual-card-grid-row"
            style={style}
          >
            {rowItems.map((item) => (
              <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
