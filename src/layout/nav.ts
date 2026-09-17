export type AppPage =
  | "home"
  | "library"
  | "characters"
  | "persons"
  | "settings";

export const NAV_ITEMS: { id: AppPage; label: string }[] = [
  { id: "home", label: "首页" },
  { id: "library", label: "游戏" },
];
