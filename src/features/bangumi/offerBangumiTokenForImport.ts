import { DialogConfirm } from "@/components/Dialog";
import { getStoredToken } from "./storage/tokenStorage";

export type BangumiTokenImportChoice = "settings" | "continue";

export async function offerBangumiTokenForImport(): Promise<BangumiTokenImportChoice> {
  const token = (await getStoredToken())?.trim();
  if (token) return "continue";

  const goSettings = await DialogConfirm({
    title: "提示",
    content: "未填写Bangumi Access Token，可能会导致无法搜索到游戏",
    cancelText: "取消",
    confirmText: "去填写",
  });

  return goSettings ? "settings" : "continue";
}
