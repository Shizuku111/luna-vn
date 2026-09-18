import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MessagePlugin } from "@/components/Message";
import { toErrorMessage } from "@/utils/errorMessage";
import { AppUpdateContext, type AppUpdateContextValue } from "./appUpdateContext";
import {
  checkAppUpdate,
  downloadAndInstallUpdate,
  type AppUpdateInfo,
} from "./updateApi";

export function AppUpdateProvider({ content }: { content: ReactNode }) {
  const [currentVersion, setCurrentVersion] = useState("…");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyInfo = useCallback((info: AppUpdateInfo) => {
    setCurrentVersion(info.currentVersion);
    setLatestVersion(info.latestVersion);
    setUpdateAvailable(info.updateAvailable);
    setDownloadUrl(info.downloadUrl);
    setError(null);
  }, []);

  const checkForUpdate = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      setChecking(true);
      if (!silent) {
        setError(null);
      }
      try {
        const info = await checkAppUpdate();
        applyInfo(info);
        return info;
      } catch (err) {
        const message = toErrorMessage(err, "检查更新失败");
        setError(message);
        if (!silent) {
          MessagePlugin.error(message);
        }
        return null;
      } finally {
        setChecking(false);
      }
    },
    [applyInfo],
  );

  const installUpdate = useCallback(async () => {
    if (!downloadUrl || installing) return;
    setInstalling(true);
    const loadingId = MessagePlugin.loading("正在下载更新，请稍候…");
    try {
      await downloadAndInstallUpdate(downloadUrl);
      MessagePlugin.success("已启动安装程序，应用即将退出");
    } catch (err) {
      MessagePlugin.error(toErrorMessage(err, "安装更新失败"));
      setInstalling(false);
    } finally {
      MessagePlugin.close(loadingId);
    }
  }, [downloadUrl, installing]);

  useEffect(() => {
    void checkForUpdate({ silent: true });
  }, [checkForUpdate]);

  const value = useMemo<AppUpdateContextValue>(
    () => ({
      currentVersion,
      latestVersion,
      updateAvailable,
      downloadUrl,
      checking,
      installing,
      error,
      checkForUpdate,
      installUpdate,
    }),
    [
      currentVersion,
      latestVersion,
      updateAvailable,
      downloadUrl,
      checking,
      installing,
      error,
      checkForUpdate,
      installUpdate,
    ],
  );

  return (
    <AppUpdateContext.Provider value={value}>{content}</AppUpdateContext.Provider>
  );
}
