export type LibraryGameImages = {
  large?: string;
  medium?: string;
  small?: string;
};

export const LibraryGameStatus = {
  NotStarted: 0,
  Playing: 1,
  Finished: 2,
  OnHold: 3,
  Dropped: 4,
} as const;

export type LibraryGameStatusValue =
  (typeof LibraryGameStatus)[keyof typeof LibraryGameStatus];

export const LIBRARY_GAME_STATUS_OPTIONS: {
  value: LibraryGameStatusValue;
  label: string;
}[] = [
  { value: LibraryGameStatus.Playing, label: "正在游玩" },
  { value: LibraryGameStatus.NotStarted, label: "未开始" },
  { value: LibraryGameStatus.Finished, label: "已完成" },
  { value: LibraryGameStatus.OnHold, label: "搁置" },
  { value: LibraryGameStatus.Dropped, label: "弃置" },
];

export type SaveLibraryGameInput = {
  bangumiId: number;
  type: number;
  name: string;
  nameCn: string;
  summary?: string | null;
  date?: string | null;
  image?: string | null;
  images?: LibraryGameImages | null;
  score?: number | null;
  rank?: number | null;
  tags: string[];
  nsfw?: boolean | null;
  infobox?: unknown;
  launchPath: string;
};

export type SaveManualLibraryGameInput = {
  bangumiId?: number | null;
  name: string;
  nameCn: string;
  launchPath: string;
  coverSourcePath?: string | null;
};

export type UpdateLibraryGameSubject = {
  type: number;
  summary?: string | null;
  date?: string | null;
  image?: string | null;
  images?: LibraryGameImages | null;
  score?: number | null;
  rank?: number | null;
  tags: string[];
  nsfw?: boolean | null;
  infobox?: unknown;
};

export type UpdateLibraryGameInput = {
  id: number;
  bangumiId: number;
  name: string;
  nameCn: string;
  launchPath: string;
  coverSourcePath?: string | null;
  subject?: UpdateLibraryGameSubject | null;
  updateCover?: boolean | null;
};

export type SavedLibraryGame = {
  id: number;
  bangumiId: number;
};

export type LibraryGameArchive = {
  id: number;
  tag: string;
  createdAt: string;
};

export type LibraryGame = {
  id: number;
  bangumiId: number;
  type: number;
  name: string;
  nameCn: string;
  summary?: string | null;
  date?: string | null;
  image?: string | null;
  images?: LibraryGameImages | null;
  score?: number | null;
  rank?: number | null;
  tags: string[];
  nsfw: boolean;
  infobox?: unknown;
  launchPath: string;
  status: LibraryGameStatusValue;
  regionLaunch: boolean;
  favorite: boolean;
  wishlist: boolean;
  archived?: LibraryGameArchive | null;
  lastLaunchedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  coverPath?: string | null;
};

export type GameLogAction =
  | "import"
  | "open"
  | "favorite"
  | "unfavorite"
  | "wishlist"
  | "unwishlist"
  | "status_not_started"
  | "status_playing"
  | "status_finished"
  | "status_on_hold"
  | "status_dropped"
  | "archive"
  | "unarchive"
  | string;

export type GameLogItem = {
  id: number;
  gameId: number;
  bangumiId: number;
  action: GameLogAction;
  sessionId?: string | null;
  createdAt: string;
  name: string;
  nameCn: string;
  image?: string | null;
  coverPath?: string | null;
  infobox?: unknown;
  nsfw: boolean;
};

export type SaveGameRelationInput = {
  relatedGameId: number;
  relation?: string | null;
  sortOrder?: number | null;
};

export type LibraryGameRelation = {
  gameId: number;
  relatedGameId: number;
  relation: string;
  sortOrder: number;
  game: LibraryGame;
};
