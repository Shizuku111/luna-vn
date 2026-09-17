import {
  DetailOverlay,
  type DetailOpenOrigin,
} from "@/components/DetailOverlay";
import { EntityPage, type EntityKind } from "./EntityPage";
import "./Entity.css";

type EntityOverlayProps = {
  kind: EntityKind;
  entityId: number;
  origin?: DetailOpenOrigin | null;
  zIndex?: number;
  chromeActive?: boolean;
  onClose: () => void;
  onClosing?: () => void;
  onEnterReady?: () => void;
  onDeleted?: () => void;
  onUpdated?: () => void;
  onOpenGame?: (gameId: number, origin?: DetailOpenOrigin | null) => void;
  onOpenCharacter?: (
    characterId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
  onOpenPerson?: (
    personId: number,
    origin?: DetailOpenOrigin | null,
  ) => void;
};

export function EntityOverlay({
  kind,
  entityId,
  origin = null,
  zIndex,
  chromeActive = true,
  onClose,
  onClosing,
  onEnterReady,
  onDeleted,
  onUpdated,
  onOpenGame,
  onOpenCharacter,
  onOpenPerson,
}: EntityOverlayProps) {
  return (
    <DetailOverlay
      origin={origin}
      animKey={`${kind}-${entityId}`}
      onClose={onClose}
      onClosing={onClosing}
      onEnterReady={onEnterReady}
      chromeActive={chromeActive}
      className="entity-overlay"
      style={zIndex != null ? { zIndex } : undefined}
    >
      {(requestClose) => (
        <EntityPage
          kind={kind}
          entityId={entityId}
          onBack={requestClose}
          onDeleted={onDeleted}
          onUpdated={onUpdated}
          onOpenGame={onOpenGame}
          onOpenCharacter={onOpenCharacter}
          onOpenPerson={onOpenPerson}
        />
      )}
    </DetailOverlay>
  );
}
