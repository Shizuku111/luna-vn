import { createContext } from "react";
import type { AppUpdateInfo } from "./updateApi";

export type AppUpdateContextValue = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  downloadUrl: string | null;
  checking: boolean;
  installing: boolean;
  error: string | null;
  checkForUpdate: (opts?: { silent?: boolean }) => Promise<AppUpdateInfo | null>;
  installUpdate: () => Promise<void>;
};

export const AppUpdateContext = createContext<AppUpdateContextValue | null>(
  null,
);
