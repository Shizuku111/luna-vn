import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./Tabs.css";

export type TabsItem = {
  key: string;
  label: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabsItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (key: string) => void;
  className?: string;
  shortIndicator?: boolean;
  "aria-label"?: string;
};

type IndicatorStyle = {
  left: number;
  width: number;
  ready: boolean;
};

export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  className = "",
  shortIndicator = false,
  "aria-label": ariaLabel = "选项卡",
}: TabsProps) {
  const firstEnabled = items.find((item) => !item.disabled)?.key ?? "";
  const [uncontrolled, setUncontrolled] = useState(
    defaultValue ?? firstEnabled,
  );
  const activeKey = value ?? uncontrolled;
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<IndicatorStyle>({
    left: 0,
    width: 0,
    ready: false,
  });
  const [animated, setAnimated] = useState(false);
  const itemsSignature = items.map((item) => item.key).join("\0");

  function select(key: string) {
    if (value === undefined) {
      setUncontrolled(key);
    }
    onChange?.(key);
  }

  function handleItemClick(key: string, disabled?: boolean) {
    if (disabled || key === activeKey) return;
    select(key);
  }

  function measureIndicator(): IndicatorStyle | null {
    const active = itemRefs.current.get(activeKey);
    if (!active) return null;

    const tabWidth = active.offsetWidth;
    if (tabWidth <= 0) return null;

    if (shortIndicator) {
      const fontSize =
        Number.parseFloat(getComputedStyle(active).fontSize) || 16;
      const width = fontSize * 1.1;
      const left = active.offsetLeft + (tabWidth - width) / 2;
      return { left, width, ready: true };
    }

    return { left: active.offsetLeft, width: tabWidth, ready: true };
  }

  function updateIndicator() {
    const next = measureIndicator();
    if (!next) {
      setIndicator((prev) => ({ ...prev, ready: false, width: 0 }));
      return;
    }
    setIndicator((prev) => {
      if (
        prev.ready &&
        prev.left === next.left &&
        prev.width === next.width
      ) {
        return prev;
      }
      return next;
    });
  }

  useLayoutEffect(() => {
    updateIndicator();
  }, [activeKey, itemsSignature, shortIndicator]);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;

    function settleInitial() {
      updateIndicator();
      frame = window.requestAnimationFrame(() => {
        if (cancelled) return;
        updateIndicator();
        setAnimated(true);
      });
    }

    settleInitial();

    const root = rootRef.current;
    const observer =
      root && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateIndicator();
          })
        : null;

    if (observer && root) {
      observer.observe(root);
      for (const node of itemRefs.current.values()) {
        observer.observe(node);
      }
    }

    window.addEventListener("resize", updateIndicator);

    void (async () => {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
      }
      if (cancelled) return;
      updateIndicator();
    })();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeKey, itemsSignature, shortIndicator]);

  return (
    <div
      ref={rootRef}
      className={[
        "ui-tabs",
        shortIndicator ? "ui-tabs--short-indicator" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            ref={(node) => {
              if (node) itemRefs.current.set(item.key, node);
              else itemRefs.current.delete(item.key);
            }}
            type="button"
            role="tab"
            className={[
              "ui-tabs-item",
              active ? "is-active" : "",
              item.disabled ? "is-disabled" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-selected={active}
            disabled={item.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => handleItemClick(item.key, item.disabled)}
          >
            {item.label}
          </button>
        );
      })}
      <span
        className={[
          "ui-tabs-indicator",
          indicator.ready ? "is-ready" : "",
          animated ? "is-animated" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden
        style={{
          transform: `translateX(${indicator.left}px)`,
          width: indicator.width,
        }}
      />
    </div>
  );
}
