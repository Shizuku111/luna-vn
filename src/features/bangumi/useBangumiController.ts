import { useContext } from "react";
import { BangumiContext } from "./bangumiContext";

export function useBangumiController() {
  const value = useContext(BangumiContext);
  if (!value) {
    throw new Error("useBangumiController must be used within BangumiProvider");
  }
  return value;
}
