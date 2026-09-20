import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { Dialog } from "@/components/Dialog";
import { Input } from "@/components/Input";
import { listRecentArchiveTags } from "../libraryStore";
import "./ArchiveGameDialog.css";

export type ArchiveGameDialogOptions = {
  title?: ReactNode;
  cancelText?: ReactNode;
  confirmText?: ReactNode;
};

type ArchiveGameDialogViewProps = ArchiveGameDialogOptions & {
  onSettle: (tag: string | null) => void;
};

const PANEL_GAP = 6;

function ArchiveGameDialogView({
  title = "归档游戏",
  cancelText = "取消",
  confirmText = "确认归档",
  onSettle,
}: ArchiveGameDialogViewProps) {
  const [open, setOpen] = useState(true);
  const [tag, setTag] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentTags, setRecentTags] = useState<string[]>([]);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    let cancelled = false;
    void listRecentArchiveTags(5)
      .then((tags) => {
        if (cancelled) return;
        setRecentTags(tags);
      })
      .catch(() => {
        if (!cancelled) setRecentTags([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (recentTags.length === 0) return;
    const input = wrapRef.current?.querySelector("input");
    if (input && document.activeElement === input) {
      setMenuOpen(true);
    }
  }, [recentTags]);

  const showMenu = menuOpen && recentTags.length > 0;

  useLayoutEffect(() => {
    if (!showMenu || !wrapRef.current) return;

    function updatePanelPosition() {
      const trigger = wrapRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      setPanelStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        top: rect.bottom + PANEL_GAP,
        zIndex: 2300,
      });
    }

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [showMenu, recentTags.length]);

  function finish(result: string | null) {
    setMenuOpen(false);
    setOpen(false);
    onSettle(result);
  }

  function handleSelectTag(value: string) {
    setTag(value);
    setMenuOpen(false);
  }

  const panel =
    showMenu && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            className="archive-game-suggest-panel"
            role="presentation"
            style={panelStyle}
          >
            <ul id={listboxId} className="archive-game-suggest-list" role="listbox">
              {recentTags.map((item) => {
                const selected = tag === item;
                return (
                  <li key={item} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={[
                        "archive-game-suggest-option",
                        selected ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={item}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => handleSelectTag(item)}
                    >
                      {item}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <Dialog
      open={open}
      title={title}
      className="archive-game-dialog"
      content={
        <div className="archive-game-field">
          <label className="archive-game-label" htmlFor="archive-game-tag">
            标签
          </label>
          <div ref={wrapRef} className="archive-game-combobox">
            <Input
              id="archive-game-tag"
              autoFocus
              value={tag}
              placeholder="储存位置或说明"
              aria-autocomplete="list"
              aria-expanded={showMenu}
              aria-controls={showMenu ? listboxId : undefined}
              onFocus={() => {
                if (recentTags.length > 0) setMenuOpen(true);
              }}
              onBlur={() => setMenuOpen(false)}
              onChange={(event) => {
                setTag(event.target.value);
                if (recentTags.length > 0) setMenuOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && menuOpen) {
                  event.preventDefault();
                  setMenuOpen(false);
                  return;
                }
                if (event.key !== "Enter" || event.nativeEvent.isComposing) {
                  return;
                }
                event.preventDefault();
                finish(tag.trim());
              }}
            />
          </div>
          {panel}
        </div>
      }
      cancelText={cancelText}
      confirmText={confirmText}
      onClose={() => finish(null)}
      onConfirm={() => finish(tag.trim())}
    />
  );
}

export function ArchiveGameDialog(
  options: ArchiveGameDialogOptions = {},
): Promise<string | null> {
  if (typeof document === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "archive-game-dialog-host";
    document.body.appendChild(host);

    const root: Root = createRoot(host);
    let settled = false;

    function cleanup(tag: string | null) {
      if (settled) return;
      settled = true;
      resolve(tag);
      window.setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    }

    root.render(<ArchiveGameDialogView {...options} onSettle={cleanup} />);
  });
}
