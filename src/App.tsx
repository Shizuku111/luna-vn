import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BangumiProvider, offerBangumiTokenForImport } from "@/features/bangumi";
import {
  LibraryGamesProvider,
  useLibraryGames,
  type LibraryGame,
} from "@/features/library";
import {
  AppearanceBootstrap,
  BangumiConcurrencyBootstrap,
  CloseBehaviorBootstrap,
} from "@/features/settings";
import { AppUpdateProvider } from "@/features/update";
import { Layout, type AppPage } from "@/layout";
import type { DetailOpenOrigin } from "@/components/DetailOverlay";
import { EntityOverlay, type EntityKind } from "@/pages/Entity";
import { GameOverlay } from "@/pages/Game";
import "./App.css";

const HomePage = lazy(() =>
  import("@/pages/Home").then((m) => ({ default: m.HomePage })),
);
const LibraryPage = lazy(() =>
  import("@/pages/Library").then((m) => ({ default: m.LibraryPage })),
);
const CharactersPage = lazy(() =>
  import("@/pages/Characters").then((m) => ({ default: m.CharactersPage })),
);
const PersonsPage = lazy(() =>
  import("@/pages/Persons").then((m) => ({ default: m.PersonsPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/Settings").then((m) => ({ default: m.SettingsPage })),
);

type DetailLayer =
  | {
      key: number;
      type: "game";
      gameId: number;
      origin: DetailOpenOrigin | null;
    }
  | {
      key: number;
      type: "entity";
      kind: EntityKind;
      id: number;
      origin: DetailOpenOrigin | null;
    };

const DETAIL_Z_BASE = 30;

function PageFallback() {
  return <div className="app-page-fallback" aria-busy="true" />;
}

function withPageSuspense(node: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

function AppContent() {
  const { refresh, upsertGame, removeGame, revision: gamesRevision } =
    useLibraryGames();
  const [page, setPage] = useState<AppPage>("home");
  const [layers, setLayers] = useState<DetailLayer[]>([]);
  const [closingLayerKeys, setClosingLayerKeys] = useState<number[]>([]);
  const [overlayGlassReady, setOverlayGlassReady] = useState(false);
  const layerKeyRef = useRef(0);
  const [charactersRevision, setCharactersRevision] = useState(0);
  const [personsRevision, setPersonsRevision] = useState(0);

  function refreshCharacters() {
    setCharactersRevision((value) => value + 1);
  }

  function refreshPersons() {
    setPersonsRevision((value) => value + 1);
  }

  function refreshAllLibraryIndexes() {
    void refresh();
    refreshCharacters();
    refreshPersons();
  }

  function navigate(next: AppPage) {
    if (layers.some((layer) => layer.type === "entity" && layer.kind === "character")) {
      refreshCharacters();
    }
    if (layers.some((layer) => layer.type === "entity" && layer.kind === "person")) {
      refreshPersons();
    }
    setLayers([]);
    setClosingLayerKeys([]);
    setOverlayGlassReady(false);
    setPage(next);
  }

  function pushLayer(layer: DetailLayer) {
    setLayers((prev) => [...prev, layer]);
  }

  function markLayerClosing(key: number) {
    setClosingLayerKeys((prev) =>
      prev.includes(key) ? prev : [...prev, key],
    );
  }

  function closeLayer(key: number) {
    setLayers((prev) => prev.filter((layer) => layer.key !== key));
    setClosingLayerKeys((prev) => prev.filter((item) => item !== key));
  }

  function handleOpenGame(
    gameId: number,
    origin: DetailOpenOrigin | null = null,
  ) {
    pushLayer({
      key: ++layerKeyRef.current,
      type: "game",
      gameId,
      origin,
    });
  }

  function handleOpenCharacter(
    id: number,
    origin: DetailOpenOrigin | null = null,
  ) {
    pushLayer({
      key: ++layerKeyRef.current,
      type: "entity",
      kind: "character",
      id,
      origin,
    });
  }

  function handleOpenPerson(
    id: number,
    origin: DetailOpenOrigin | null = null,
  ) {
    pushLayer({
      key: ++layerKeyRef.current,
      type: "entity",
      kind: "person",
      id,
      origin,
    });
  }

  function handleGameUpdated(game: LibraryGame) {
    upsertGame(game);
  }

  function handleGameDeleted(gameId: number) {
    removeGame(gameId);
  }

  const visibleLayers = layers.filter(
    (layer) => !closingLayerKeys.includes(layer.key),
  );
  const topVisibleLayerKey =
    visibleLayers.length > 0
      ? visibleLayers[visibleLayers.length - 1].key
      : null;
  const hasVisibleOverlay = visibleLayers.length > 0;

  useEffect(() => {
    if (!hasVisibleOverlay) setOverlayGlassReady(false);
  }, [hasVisibleOverlay]);

  function renderPage() {
    switch (page) {
      case "home":
        return withPageSuspense(
          <HomePage
            onOpenGame={handleOpenGame}
            onAddGame={() => {
              void (async () => {
                const choice = await offerBangumiTokenForImport();
                if (choice === "settings") {
                  navigate("settings");
                  return;
                }
                navigate("library");
              })();
            }}
          />,
        );
      case "library":
        return withPageSuspense(
          <LibraryPage
            onOpenGame={handleOpenGame}
            onNavigateToSettings={() => navigate("settings")}
          />,
        );
      case "characters":
        return withPageSuspense(
          <CharactersPage
            onOpenCharacter={handleOpenCharacter}
            refreshToken={charactersRevision}
          />,
        );
      case "persons":
        return withPageSuspense(
          <PersonsPage
            onOpenPerson={handleOpenPerson}
            refreshToken={personsRevision}
          />,
        );
      case "settings":
        return withPageSuspense(
          <SettingsPage
            onLibraryDataCleared={refreshAllLibraryIndexes}
            onImageCacheCleared={refreshAllLibraryIndexes}
            onNsfwVisibilityChanged={refreshAllLibraryIndexes}
          />,
        );
    }
  }

  return (
    <Layout
      page={page}
      onNavigate={navigate}
      searchRevision={`${gamesRevision}:${charactersRevision}:${personsRevision}`}
      onOpenGame={handleOpenGame}
      onOpenCharacter={handleOpenCharacter}
      onOpenPerson={handleOpenPerson}
      content={renderPage()}
      hasOverlay={hasVisibleOverlay && overlayGlassReady}
      overlay={layers.map((layer, index) => {
        const zIndex = DETAIL_Z_BASE + index;
        const chromeActive = layer.key === topVisibleLayerKey;
        if (layer.type === "game") {
          return (
            <GameOverlay
              key={layer.key}
              gameId={layer.gameId}
              origin={layer.origin}
              zIndex={zIndex}
              chromeActive={chromeActive}
              onEnterReady={() => setOverlayGlassReady(true)}
              onClosing={() => markLayerClosing(layer.key)}
              onClose={() => closeLayer(layer.key)}
              onUpdated={handleGameUpdated}
              onDeleted={() => handleGameDeleted(layer.gameId)}
              onOpenCharacter={handleOpenCharacter}
              onOpenPerson={handleOpenPerson}
              onOpenGame={handleOpenGame}
            />
          );
        }
        return (
          <EntityOverlay
            key={layer.key}
            kind={layer.kind}
            entityId={layer.id}
            origin={layer.origin}
            zIndex={zIndex}
            chromeActive={chromeActive}
            onEnterReady={() => setOverlayGlassReady(true)}
            onClosing={() => {
              markLayerClosing(layer.key);
              if (layer.kind === "character") refreshCharacters();
              else refreshPersons();
            }}
            onClose={() => closeLayer(layer.key)}
            onDeleted={() => {
              if (layer.kind === "character") refreshCharacters();
              else refreshPersons();
            }}
            onUpdated={
              layer.kind === "character" ? refreshCharacters : refreshPersons
            }
            onOpenGame={handleOpenGame}
            onOpenCharacter={handleOpenCharacter}
            onOpenPerson={handleOpenPerson}
          />
        );
      })}
    />
  );
}

function App() {
  return (
    <>
      <AppearanceBootstrap />
      <BangumiConcurrencyBootstrap />
      <CloseBehaviorBootstrap />
      <AppUpdateProvider
        content={
          <BangumiProvider
            content={
              <LibraryGamesProvider content={<AppContent />} />
            }
          />
        }
      />
    </>
  );
}

export default App;
