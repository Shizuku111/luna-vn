import { useEffect, useState } from "react";
import bangumiIcon from "@/assets/bangumi-icon.png";
import { Button } from "@/components/Button";
import { DialogConfirm } from "@/components/Dialog";
import { Input } from "@/components/Input";
import { MessagePlugin } from "@/components/Message";
import { Select } from "@/components/Select";
import { Switch } from "@/components/Switch";
import { Tag } from "@/components/Tag";
import { useBangumiController } from "@/features/bangumi";
import {
  APPEARANCE_MODE_OPTIONS,
  BANGUMI_MAX_CONCURRENT_MAX,
  BANGUMI_MAX_CONCURRENT_MIN,
  CLOSE_BEHAVIOR_OPTIONS,
  clearLibraryData,
  clearImageCache,
  clampBangumiMaxConcurrent,
  LEPathField,
  openImageCacheDir,
  useSettingsController,
} from "@/features/settings";
import { useAppUpdate } from "@/features/update";
import { toErrorMessage } from "@/utils/errorMessage";
import "./Settings.css";

export function SettingsPage({
  onLibraryDataCleared,
  onNsfwVisibilityChanged,
}: {
  onLibraryDataCleared?: () => void;
  onNsfwVisibilityChanged?: () => void;
} = {}) {
  const {
    token,
    setToken,
    user,
    tokenExpiresAt,
    loading,
    hydrating,
    error,
    isLoggedIn,
    openTokenCreatePage,
    saveToken,
    logout,
  } = useBangumiController();
  const {
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
    hydrating: settingsHydrating,
  } = useSettingsController();
  const [clearing, setClearing] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [openingCacheDir, setOpeningCacheDir] = useState(false);
  const [bangumiConcurrentDraft, setBangumiConcurrentDraft] = useState(
    String(bangumiMaxConcurrent),
  );
  const {
    currentVersion,
    latestVersion,
    updateAvailable,
    checking: checkingUpdate,
    installing: installingUpdate,
    checkForUpdate,
    installUpdate,
  } = useAppUpdate();

  useEffect(() => {
    setBangumiConcurrentDraft(String(bangumiMaxConcurrent));
  }, [bangumiMaxConcurrent]);

  function commitBangumiMaxConcurrent() {
    const next = clampBangumiMaxConcurrent(Number(bangumiConcurrentDraft));
    setBangumiMaxConcurrent(next);
    setBangumiConcurrentDraft(String(next));
  }

  function handleLogout() {
    void (async () => {
      const ok = await DialogConfirm({
        title: "退出登录",
        content: "退出后可能无法从 Bangumi 获取到游戏数据",
        confirmText: "退出",
        confirmTheme: "danger",
      });
      if (!ok) return;
      await logout();
    })();
  }

  function handleTokenBlur() {
    void saveToken();
  }

  function handleShowNsfwChange(checked: boolean) {
    void (async () => {
      await setShowNsfw(checked);
      onNsfwVisibilityChanged?.();
    })();
  }

  function handleClearLibraryData() {
    if (clearing || clearingCache || openingCacheDir) return;
    void (async () => {
      const ok = await DialogConfirm({
        title: "清除所有数据",
        content:
          "确定清除本地游戏库中的全部游戏、角色、人物、关联数据及角色/人物图片缓存吗？此操作不可恢复。Bangumi 账号、Token 与应用设置不会被清除。",
        confirmText: "清除",
        confirmTheme: "danger",
      });
      if (!ok) return;

      setClearing(true);
      try {
        await clearLibraryData();
        onLibraryDataCleared?.();
        MessagePlugin.success("已清除全部库数据");
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "清除失败"));
      } finally {
        setClearing(false);
      }
    })();
  }

  function handleClearImageCache() {
    if (clearing || clearingCache || openingCacheDir) return;
    void (async () => {
      const ok = await DialogConfirm({
        title: "清除缓存数据",
        content:
          "确定清除已下载的角色与人物图片缓存吗？游戏库数据不会受影响，之后查看相关图片时会重新下载。",
        confirmText: "清除缓存",
      });
      if (!ok) return;

      setClearingCache(true);
      try {
        await clearImageCache();
        MessagePlugin.success("已清除图片缓存");
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "清除缓存失败"));
      } finally {
        setClearingCache(false);
      }
    })();
  }

  function handleOpenImageCacheDir() {
    if (clearing || clearingCache || openingCacheDir) return;
    void (async () => {
      setOpeningCacheDir(true);
      try {
        await openImageCacheDir();
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "打开缓存目录失败"));
      } finally {
        setOpeningCacheDir(false);
      }
    })();
  }

  return (
    <section className="settings-page">
      <section className="settings-section">
        <header className="settings-section-header">
          <img
            className="settings-section-icon"
            src={bangumiIcon}
            alt="Bangumi"
          />
          <h2 className="settings-section-label">Bangumi Access Token</h2>
        </header>
        <div className="settings-block">
          {isLoggedIn && user ? (
            <div className="settings-row settings-account">
              <img
                className="settings-account-avatar"
                src={user.avatar.large || user.avatar.medium}
                alt={user.nickname}
              />

              <div className="settings-account-meta">
                <div className="settings-account-title">
                  <span className="settings-account-name" title={user.nickname}>
                    {user.nickname}
                  </span>
                  <span className="settings-account-id">@{user.id}</span>
                </div>
                <p className="settings-account-expiry">
                  {tokenExpiresAt
                    ? `Token 有效期至 ${tokenExpiresAt}`
                    : loading
                      ? "正在获取 Token 有效期…"
                      : "Token 有效期未知"}
                </p>
              </div>

              <div className="settings-row-control">
                <Button
                  theme="danger"
                  disabled={loading || hydrating}
                  onClick={handleLogout}
                  content="退出登录"
                />
              </div>
            </div>
          ) : (
            <div className="settings-bangumi-login">
              <Input
                size="large"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onBlur={handleTokenBlur}
                placeholder="请输入 Access Token"
                aria-label="Bangumi Access Token"
                autoComplete="off"
                disabled={hydrating || loading}
              />

              {error ? <p className="settings-block-error">{error}</p> : null}

              <div className="settings-block-actions">
                <Button
                  theme="primary"
                  onClick={openTokenCreatePage}
                  content="获取令牌"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <header className="settings-section-header">
          <h2 className="settings-section-label">显示设置</h2>
        </header>
        <div className="settings-block">
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">外观设置</span>
              <span className="settings-row-hint">
                选择界面配色：白天、夜间，或跟随系统
              </span>
            </div>
            <div className="settings-row-control">
              <Select
                value={appearance}
                options={[...APPEARANCE_MODE_OPTIONS]}
                onChange={setAppearance}
                disabled={settingsHydrating}
              />
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">显示游戏原名</span>
              <span className="settings-row-hint">
                影响所有游戏的标题显示，关闭后，如果游戏没有对应的中文名则显示原名
              </span>
            </div>
            <div className="settings-row-control">
              <Switch
                checked={showOriginalName}
                disabled={settingsHydrating}
                onChange={setShowOriginalName}
                aria-label="显示游戏原名"
              />
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">显示 NSFW 内容</span>
              <span className="settings-row-hint">
                是否显示 NSFW 内容，可能会导致添加游戏时无法从数据源搜索到游戏
              </span>
            </div>
            <div className="settings-row-control">
              <Switch
                checked={showNsfw}
                disabled={settingsHydrating}
                onChange={handleShowNsfwChange}
                aria-label="显示 NSFW 内容"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <header className="settings-section-header">
          <h2 className="settings-section-label">网络</h2>
        </header>
        <div className="settings-block">
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">
                Bangumi 最大并发请求数
              </span>
              <span className="settings-row-hint">
                同时向 Bangumi API 发起的请求上限（{BANGUMI_MAX_CONCURRENT_MIN}–
                {BANGUMI_MAX_CONCURRENT_MAX}）。数值越大批量导入、同步角色等会更快，但更容易触发限流；超出范围会自动回退到边界值。
              </span>
            </div>
            <div className="settings-row-control">
              <Input
                className="settings-concurrency-input"
                type="number"
                inputMode="numeric"
                min={BANGUMI_MAX_CONCURRENT_MIN}
                max={BANGUMI_MAX_CONCURRENT_MAX}
                step={1}
                value={bangumiConcurrentDraft}
                disabled={settingsHydrating}
                aria-label="Bangumi 最大并发请求数"
                onChange={(event) =>
                  setBangumiConcurrentDraft(event.target.value)
                }
                onBlur={commitBangumiMaxConcurrent}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <header className="settings-section-header">
          <h2 className="settings-section-label">工具</h2>
        </header>
        <div className="settings-block">
          <div className="settings-row">
            <LEPathField
              value={LEPath}
              disabled={settingsHydrating}
              onChange={setLEPath}
            />
          </div>
        </div>
      </section>

      <section className="settings-section">
        <header className="settings-section-header">
          <h2 className="settings-section-label">系统</h2>
        </header>
        <div className="settings-block">
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">关闭面板</span>
            </div>
            <div className="settings-row-control">
              <Select
                value={closeBehavior}
                options={[...CLOSE_BEHAVIOR_OPTIONS]}
                onChange={setCloseBehavior}
                disabled={settingsHydrating}
              />
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">开机自动启动</span>
            </div>
            <div className="settings-row-control">
              <Switch
                checked={launchAtStartup}
                disabled={settingsHydrating}
                onChange={(checked) => {
                  void (async () => {
                    try {
                      await setLaunchAtStartup(checked);
                    } catch (err) {
                      MessagePlugin.error(
                        toErrorMessage(err, "设置开机自动启动失败"),
                      );
                    }
                  })();
                }}
                aria-label="开机自动启动"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <header className="settings-section-header">
          <h2 className="settings-section-label">数据管理</h2>
        </header>
        <div className="settings-block">
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">清除所有数据</span>
              <span className="settings-row-hint">
                删除本地游戏库中的游戏、角色、人物、关联记录及角色/人物图片缓存；不会清除
                Bangumi 账号、Token 与应用设置
              </span>
            </div>
            <div className="settings-row-control">
              <Button
                theme="danger"
                disabled={clearing || clearingCache || openingCacheDir}
                onClick={handleClearLibraryData}
                content={clearing ? "清除中…" : "清除所有数据"}
              />
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">清除缓存数据</span>
              <span className="settings-row-hint">
                仅删除已缓存的角色与人物图片，不影响游戏库与设置；离线时相关图片可能暂时无法显示，联网后会重新下载
              </span>
            </div>
            <div className="settings-row-control">
              <Button
                disabled={clearing || clearingCache || openingCacheDir}
                onClick={handleClearImageCache}
                content={clearingCache ? "清除中…" : "清除缓存"}
              />
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">打开缓存目录</span>
            </div>
            <div className="settings-row-control">
              <Button
                disabled={clearing || clearingCache || openingCacheDir}
                onClick={handleOpenImageCacheDir}
                content={openingCacheDir ? "打开中…" : "打开缓存目录"}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section" id="settings-about">
        <header className="settings-section-header">
          <h2 className="settings-section-label">关于</h2>
        </header>
        <div className="settings-block">
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">当前版本</span>
              <span className="settings-row-hint">
                {updateAvailable && latestVersion
                  ? `发现新版本 ${latestVersion}`
                  : ""}
              </span>
            </div>
            <div className="settings-row-control settings-about-control">
              <span className="settings-version">{currentVersion}</span>
              {updateAvailable ? (
                <Tag
                  theme="primary"
                  size="small"
                  content="有可用更新"
                  interactive={false}
                />
              ) : null}
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">
                {updateAvailable ? "应用更新" : "检查更新"}
              </span>
            </div>
            <div className="settings-row-control">
              {updateAvailable ? (
                <Button
                  theme="primary"
                  disabled={installingUpdate || checkingUpdate}
                  onClick={() => {
                    void installUpdate();
                  }}
                  content={installingUpdate ? "下载中…" : "下载并更新"}
                />
              ) : (
                <Button
                  disabled={checkingUpdate || installingUpdate}
                  onClick={() => {
                    void (async () => {
                      const info = await checkForUpdate();
                      if (!info) return;
                      if (info.updateAvailable) {
                        MessagePlugin.success(
                          `发现新版本 ${info.latestVersion}`,
                        );
                      } else {
                        MessagePlugin.success("当前已是最新版本");
                      }
                    })();
                  }}
                  content={checkingUpdate ? "检查中…" : "检查更新"}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
