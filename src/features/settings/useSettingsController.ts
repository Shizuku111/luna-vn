import { useCallback, useEffect, useState } from "react";
import { setBangumiMaxConcurrent as applyBangumiMaxConcurrent } from "@/features/bangumi/bangumiConcurrency";
import { applyAppearance } from "./applyAppearance";
import {
  getLaunchAtStartup,
  setLaunchAtStartup as saveLaunchAtStartup,
} from "./autostart";
import {
  AppearanceMode,
  BANGUMI_MAX_CONCURRENT_DEFAULT,
  CloseBehavior,
  clampBangumiMaxConcurrent,
  getAppearance,
  getBangumiMaxConcurrent,
  getCloseBehavior,
  getLEPath,
  getShowNsfw,
  getShowOriginalName,
  setAppearance as saveAppearance,
  setBangumiMaxConcurrent as saveBangumiMaxConcurrent,
  setCloseBehavior as saveCloseBehavior,
  setLEPath as saveLEPath,
  setShowNsfw as saveShowNsfw,
  setShowOriginalName as saveShowOriginalName,
  type AppearanceModeValue,
  type CloseBehaviorValue,
} from "./storage/settingsStore";

export function useSettingsController() {
  const [showOriginalName, setShowOriginalNameState] = useState(true);
  const [showNsfw, setShowNsfwState] = useState(true);
  const [appearance, setAppearanceState] = useState<AppearanceModeValue>(
    AppearanceMode.Light,
  );
  const [LEPath, setLEPathState] = useState("");
  const [closeBehavior, setCloseBehaviorState] = useState<CloseBehaviorValue>(
    CloseBehavior.Ask,
  );
  const [launchAtStartup, setLaunchAtStartupState] = useState(false);
  const [bangumiMaxConcurrent, setBangumiMaxConcurrentState] = useState(
    BANGUMI_MAX_CONCURRENT_DEFAULT,
  );
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [
          originalName,
          nsfw,
          nextAppearance,
          lePath,
          nextCloseBehavior,
          nextLaunchAtStartup,
          nextBangumiMaxConcurrent,
        ] = await Promise.all([
          getShowOriginalName(),
          getShowNsfw(),
          getAppearance(),
          getLEPath(),
          getCloseBehavior(),
          getLaunchAtStartup(),
          getBangumiMaxConcurrent(),
        ]);
        if (!cancelled) {
          setShowOriginalNameState(originalName);
          setShowNsfwState(nsfw);
          setAppearanceState(nextAppearance);
          applyAppearance(nextAppearance);
          setLEPathState(lePath);
          setCloseBehaviorState(nextCloseBehavior);
          setLaunchAtStartupState(nextLaunchAtStartup);
          setBangumiMaxConcurrentState(nextBangumiMaxConcurrent);
          applyBangumiMaxConcurrent(nextBangumiMaxConcurrent);
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setShowOriginalName = useCallback((value: boolean) => {
    setShowOriginalNameState(value);
    void saveShowOriginalName(value);
  }, []);

  const setShowNsfw = useCallback(async (value: boolean) => {
    setShowNsfwState(value);
    await saveShowNsfw(value);
  }, []);

  const setAppearance = useCallback((value: AppearanceModeValue) => {
    setAppearanceState(value);
    applyAppearance(value);
    void saveAppearance(value);
  }, []);

  const setLEPath = useCallback((value: string) => {
    setLEPathState(value);
    void saveLEPath(value);
  }, []);

  const setCloseBehavior = useCallback((value: CloseBehaviorValue) => {
    setCloseBehaviorState(value);
    void saveCloseBehavior(value);
  }, []);

  const setLaunchAtStartup = useCallback(async (value: boolean) => {
    setLaunchAtStartupState(value);
    try {
      await saveLaunchAtStartup(value);
    } catch {
      setLaunchAtStartupState(!value);
      throw new Error("设置开机自动启动失败");
    }
  }, []);

  const setBangumiMaxConcurrent = useCallback((value: number) => {
    const next = clampBangumiMaxConcurrent(value);
    setBangumiMaxConcurrentState(next);
    applyBangumiMaxConcurrent(next);
    void saveBangumiMaxConcurrent(next);
  }, []);

  return {
    showOriginalName,
    setShowOriginalName,
    showNsfw,
    setShowNsfw,
    appearance,
    setAppearance,
    LEPath,
    setLEPath,
    closeBehavior,
    setCloseBehavior,
    launchAtStartup,
    setLaunchAtStartup,
    bangumiMaxConcurrent,
    setBangumiMaxConcurrent,
    hydrating,
  };
}
