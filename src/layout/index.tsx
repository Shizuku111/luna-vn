import type { ReactNode } from "react";
import { TitleBar } from "./TitleBar";
import type { AppPage } from "./nav";
import "./shell.css";

type LayoutProps = {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
  content: ReactNode;
  overlay?: ReactNode;
  hasOverlay?: boolean;
  searchRevision?: number | string;
  onOpenGame?: (gameId: number) => void;
  onOpenCharacter?: (characterId: number) => void;
  onOpenPerson?: (personId: number) => void;
};

export function Layout({
  page,
  onNavigate,
  content,
  overlay,
  hasOverlay = false,
  searchRevision,
  onOpenGame,
  onOpenCharacter,
  onOpenPerson,
}: LayoutProps) {
  return (
    <div
      className="app-shell"
      data-page={page}
      data-has-overlay={hasOverlay ? "true" : undefined}
    >
      <TitleBar
        page={page}
        onNavigate={onNavigate}
        searchRevision={searchRevision}
        onOpenGame={onOpenGame}
        onOpenCharacter={onOpenCharacter}
        onOpenPerson={onOpenPerson}
      />
      <div className="app-glassmorphism-overlay" aria-hidden />
      <div className="app-body">
        <main className="app-content">
          <div className="app-content-body">{content}</div>
          {overlay}
        </main>
      </div>
    </div>
  );
}

export type { AppPage } from "./nav";
