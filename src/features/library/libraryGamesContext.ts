import { createContext } from "react";
import type { LibraryGame } from "./types";

export type LibraryGamesControllerValue = {
  games: LibraryGame[];
  loading: boolean;
  revision: number;
  refresh: () => Promise<void>;
  upsertGame: (game: LibraryGame) => void;
  removeGame: (id: number) => void;
};

export const LibraryGamesContext =
  createContext<LibraryGamesControllerValue | null>(null);
