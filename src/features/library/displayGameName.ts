import type { LibraryGame } from "./types";

export type GameListNames = {
  title: string;
  subtitle: string | null;
};

export function resolveGameListNames(
  game: Pick<LibraryGame, "name" | "nameCn">,
  showOriginalName = true,
): GameListNames {
  const name = game.name?.trim() ?? "";
  const nameCn = game.nameCn?.trim() ?? "";

  const primary = showOriginalName ? name : nameCn;
  const secondary = showOriginalName ? nameCn : name;

  const title = primary || secondary;
  const subtitle = secondary && secondary !== title ? secondary : null;

  return { title, subtitle };
}

export function displayGameName(
  game: Pick<LibraryGame, "name" | "nameCn">,
  showOriginalName = true,
) {
  return resolveGameListNames(game, showOriginalName).title;
}
