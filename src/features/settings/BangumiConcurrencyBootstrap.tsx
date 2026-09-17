import { useEffect } from "react";
import { setBangumiMaxConcurrent as applyBangumiMaxConcurrent } from "@/features/bangumi/bangumiConcurrency";
import { getBangumiMaxConcurrent } from "./storage/settingsStore";

export function BangumiConcurrencyBootstrap() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const value = await getBangumiMaxConcurrent();
      if (!cancelled) applyBangumiMaxConcurrent(value);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
