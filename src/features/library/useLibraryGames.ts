import { useContext } from "react";
import { LibraryGamesContext } from "./libraryGamesContext";

export function useLibraryGames() {
  const value = useContext(LibraryGamesContext);
  if (!value) {
    throw new Error("useLibraryGames must be used within LibraryGamesProvider");
  }
  return value;
}
