import type { LibraryGame } from "@/features/library";
import {
  DetailOverlay,
  type DetailOpenOrigin,
} from "@/components/DetailOverlay";
import { GamePage } from "./Game";

export type GameOpenOrigin = DetailOpenOrigin;

type GameOverlayProps = {
  gameId: number;
  origin?: GameOpenOrigin | null;
  zIndex?: number;
  chromeActive?: boolean;
  onClose: () => void;
  onClosing?: () => void;
  onEnterReady?: () => void;
  onUpdated?: (game: LibraryGame) => void;
  onDeleted?: () => void;
  onOpenCharacter?: (
    characterId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
  onOpenPerson?: (
    personId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
  onOpenGame?: (
    gameId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
};

export function GameOverlay({
  gameId,
  origin = null,
  zIndex,
  chromeActive = true,
  onClose,
  onClosing,
  onEnterReady,
  onUpdated,
  onDeleted,
  onOpenCharacter,
  onOpenPerson,
  onOpenGame,
}: GameOverlayProps) {
  return (
    <DetailOverlay
      origin={origin}
      animKey={gameId}
      onClose={onClose}
      onClosing={onClosing}
      onEnterReady={onEnterReady}
      chromeActive={chromeActive}
      className="game-overlay"
      style={zIndex != null ? { zIndex } : undefined}
    >
      {(requestClose) => (
        <GamePage
          gameId={gameId}
          onBack={requestClose}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
          onOpenCharacter={onOpenCharacter}
          onOpenPerson={onOpenPerson}
          onOpenGame={onOpenGame}
        />
      )}
    </DetailOverlay>
  );
}
