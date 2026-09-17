import type { ReactNode } from "react";
import {
  ActivityIcon,
  CirclePauseIcon,
  CircleSlashIcon,
  HourglassIcon,
  TaskCheckedIcon,
} from "@/components/icons";
import { LibraryGameStatus, type LibraryGameStatusValue } from "./types";

export const LIBRARY_GAME_STATUS_ICON: Record<
  LibraryGameStatusValue,
  ReactNode
> = {
  [LibraryGameStatus.Playing]: <ActivityIcon aria-hidden />,
  [LibraryGameStatus.NotStarted]: <HourglassIcon aria-hidden />,
  [LibraryGameStatus.Finished]: <TaskCheckedIcon aria-hidden />,
  [LibraryGameStatus.OnHold]: <CirclePauseIcon aria-hidden />,
  [LibraryGameStatus.Dropped]: <CircleSlashIcon aria-hidden />,
};

export const GAME_LOG_STATUS_ACTION_ICON: Record<string, ReactNode> = {
  status_playing: LIBRARY_GAME_STATUS_ICON[LibraryGameStatus.Playing],
  status_not_started: LIBRARY_GAME_STATUS_ICON[LibraryGameStatus.NotStarted],
  status_finished: LIBRARY_GAME_STATUS_ICON[LibraryGameStatus.Finished],
  status_on_hold: LIBRARY_GAME_STATUS_ICON[LibraryGameStatus.OnHold],
  status_dropped: LIBRARY_GAME_STATUS_ICON[LibraryGameStatus.Dropped],
};
