import {
  AppearanceMode,
  type AppearanceModeValue,
} from "./storage/settingsStore";

type ResolvedAppearance = "light" | "dark";

let mediaQuery: MediaQueryList | null = null;
let mediaHandler: (() => void) | null = null;
let currentMode: AppearanceModeValue = AppearanceMode.Light;

function resolveAppearance(mode: AppearanceModeValue): ResolvedAppearance {
  if (mode === AppearanceMode.Light) return "light";
  if (mode === AppearanceMode.Dark) return "dark";
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function clearSystemListener() {
  if (mediaQuery && mediaHandler) {
    mediaQuery.removeEventListener("change", mediaHandler);
  }
  mediaQuery = null;
  mediaHandler = null;
}

function syncDocumentTheme(resolved: ResolvedAppearance) {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function applyAppearance(mode: AppearanceModeValue) {
  currentMode = mode;
  clearSystemListener();
  syncDocumentTheme(resolveAppearance(mode));

  if (mode !== AppearanceMode.System || typeof window === "undefined") {
    return;
  }

  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaHandler = () => {
    if (currentMode !== AppearanceMode.System) return;
    syncDocumentTheme(resolveAppearance(AppearanceMode.System));
  };
  mediaQuery.addEventListener("change", mediaHandler);
}

export function applyDefaultAppearance() {
  applyAppearance(AppearanceMode.Light);
}
