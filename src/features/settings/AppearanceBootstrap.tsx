import { useEffect } from "react";
import { applyAppearance, applyDefaultAppearance } from "./applyAppearance";
import { getAppearance } from "./storage/settingsStore";

export function AppearanceBootstrap() {
  useEffect(() => {
    applyDefaultAppearance();
    let cancelled = false;
    void (async () => {
      const appearance = await getAppearance();
      if (!cancelled) applyAppearance(appearance);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
