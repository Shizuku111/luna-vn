import type { ReactNode } from "react";
import { formatGameLogFullTime } from "./gameLogDisplay";
import type { LibraryGame, LibraryGameArchive } from "./types";

export function isGameArchived(
  game: Pick<LibraryGame, "archived">,
): game is LibraryGame & { archived: LibraryGameArchive } {
  return game.archived != null;
}

export function formatGameArchiveTitle(archive: LibraryGameArchive) {
  const tag = archive.tag.trim();
  return tag ? `已归档-${tag}` : "已归档";
}

export function formatGameArchiveTooltip(
  archive: LibraryGameArchive,
): ReactNode {
  const title = formatGameArchiveTitle(archive);
  const time = formatGameLogFullTime(archive.createdAt);
  if (!time) return title;
  return (
    <>
      {title}
      <br />
      {time}
    </>
  );
}
