import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  SettingsIcon,
  WindowCloseIcon,
  WindowMaximizeIcon,
  WindowMinimizeIcon,
} from "@/components/icons";
import { TitleBarSearch } from "./TitleBarSearch";
import { NAV_ITEMS, type AppPage } from "./nav";
import "./TitleBar.css";

const appWindow = getCurrentWindow();

export type TitleBarProps = {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
  searchRevision?: number | string;
  onOpenGame?: (gameId: number) => void;
  onOpenCharacter?: (characterId: number) => void;
  onOpenPerson?: (personId: number) => void;
};

export function TitleBar({
  page,
  onNavigate,
  searchRevision,
  onOpenGame,
  onOpenCharacter,
  onOpenPerson,
}: TitleBarProps) {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-leading" data-tauri-drag-region>
        <div className="titlebar-brand" data-tauri-drag-region>
          <span className="titlebar-brand-mark">LUNA</span>
          <span className="titlebar-brand-sub">VN</span>
        </div>

        <nav className="titlebar-nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`titlebar-nav-item${page === item.id ? " is-active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="titlebar-drag" data-tauri-drag-region />

      <TitleBarSearch
        revision={searchRevision}
        onOpenGame={onOpenGame}
        onOpenCharacter={onOpenCharacter}
        onOpenPerson={onOpenPerson}
      />

      <div className="titlebar-controls">
        <button
          type="button"
          className={`titlebar-btn titlebar-btn-settings${
            page === "settings" ? " is-active" : ""
          }`}
          aria-label="设置"
          aria-current={page === "settings" ? "page" : undefined}
          onClick={() => onNavigate("settings")}
        >
          <SettingsIcon aria-hidden className="titlebar-btn-settings-icon" />
        </button>
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Minimize"
          onClick={() => appWindow.minimize()}
        >
          <WindowMinimizeIcon aria-hidden />
        </button>
        <button
          type="button"
          className="titlebar-btn"
          aria-label="Maximize"
          onClick={() => appWindow.toggleMaximize()}
        >
          <WindowMaximizeIcon aria-hidden />
        </button>
        <button
          type="button"
          className="titlebar-btn titlebar-btn-close"
          aria-label="Close"
          onClick={() => appWindow.close()}
        >
          <WindowCloseIcon aria-hidden />
        </button>
      </div>
    </header>
  );
}
