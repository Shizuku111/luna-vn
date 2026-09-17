import type { GameLogItem } from "./types";

export const GAME_LOG_ACTION_LABEL: Record<string, string> = {
  import: "添加游戏",
  open: "开始了游戏",
  favorite: "设为了喜欢",
  unfavorite: "取消了喜欢",
  wishlist: "设为了想玩",
  unwishlist: "取消了想玩",
  status_not_started: "未开始",
  status_playing: "正在游玩",
  status_finished: "已完成",
  status_on_hold: "搁置",
  status_dropped: "弃置",
};

export function resolveGameLogActionTone(action: string) {
  if (
    action === "import" ||
    action === "open" ||
    action === "favorite" ||
    action === "unfavorite" ||
    action === "wishlist" ||
    action === "unwishlist" ||
    action === "status_not_started" ||
    action === "status_playing" ||
    action === "status_finished" ||
    action === "status_on_hold" ||
    action === "status_dropped"
  ) {
    return action;
  }
  return "other";
}

export function parseGameLogDate(createdAt: string): Date | null {
  const seconds = Number(createdAt);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLastPlayedRelative(createdAt: string): string {
  const date = parseGameLogDate(createdAt);
  if (!date) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "刚刚";

  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (date >= lastMonthStart && date < thisMonthStart) return "上个月";

  return "更早";
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function calendarDayDiffFromToday(date: Date) {
  const today = startOfLocalDay(new Date());
  const day = startOfLocalDay(date);
  return Math.round((today - day) / 86_400_000);
}

export function formatGameLogGroupLabel(date: Date) {
  const diff = calendarDayDiffFromToday(date);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff === 2) return "两天前";
  if (diff === 3) return "三天前";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const thisYear = new Date().getFullYear();
  return year === thisYear ? `${month}-${day}` : `${year}-${month}-${day}`;
}

export function formatGameLogGroupKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatGameLogItemTime(createdAt: string) {
  const date = parseGameLogDate(createdAt);
  if (!date) return "";
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function formatGameLogListTime(createdAt: string) {
  const date = parseGameLogDate(createdAt);
  if (!date) return "";
  const time = formatGameLogItemTime(createdAt);
  if (calendarDayDiffFromToday(date) === 0) return time;
  return `${formatGameLogGroupLabel(date)} ${time}`;
}

export function formatGameLogFullTime(createdAt: string) {
  const date = parseGameLogDate(createdAt);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export type GameLogActivityGroup = {
  key: string;
  label: string;
  items: GameLogItem[];
};

export function groupGameLogActivities(
  logs: GameLogItem[],
): GameLogActivityGroup[] {
  const groups: GameLogActivityGroup[] = [];

  for (const log of logs) {
    const date = parseGameLogDate(log.createdAt);
    if (!date) continue;
    const key = formatGameLogGroupKey(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(log);
      continue;
    }
    groups.push({
      key,
      label: formatGameLogGroupLabel(date),
      items: [log],
    });
  }

  return groups;
}
