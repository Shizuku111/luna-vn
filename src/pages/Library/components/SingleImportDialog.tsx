import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { CloseIcon, SelectAppIcon } from "@/components/icons";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { Input } from "@/components/Input";
import { MessagePlugin } from "@/components/Message";
import { Tabs } from "@/components/Tabs";
import {
  useBangumiController,
  type BangumiSearchSubject,
} from "@/features/bangumi";
import {
  ensureLibraryGameRelations,
  guessGameNameFromLaunchPath,
  saveLibraryGameFromSubject,
  saveManualLibraryGame,
} from "@/features/library";
import { ensureLibraryGameCharacters } from "@/features/character";
import { toErrorMessage } from "@/utils/errorMessage";
import "@/features/library/components/EditGameDialog.css";
import { SearchResultsDialog } from "./SearchResultsDialog";
import "./SingleImportDialog.css";

type SingleImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

type ImportTab = "bangumi" | "manual";

const IMPORT_TABS = [
  { key: "bangumi", label: "从 Bangumi 导入" },
  { key: "manual", label: "手动导入" },
] as const;

function pickFileAtDefault(
  title: string,
  filters: { name: string; extensions: string[] }[],
) {
  return invoke<string | null>("pick_file_at_default", { title, filters });
}

export function SingleImportDialog({
  open,
  onClose,
  onSaved,
}: SingleImportDialogProps) {
  const { searchSubjects } = useBangumiController();
  const [tab, setTab] = useState<ImportTab>("bangumi");

  const [gameQuery, setGameQuery] = useState("");
  const [launchPath, setLaunchPath] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<BangumiSearchSubject[]>(
    [],
  );
  const [resultsOpen, setResultsOpen] = useState(false);

  const [manualBangumiId, setManualBangumiId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualNameCn, setManualNameCn] = useState("");
  const [manualLaunchPath, setManualLaunchPath] = useState("");
  const [coverSourcePath, setCoverSourcePath] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTab("bangumi");
      setGameQuery("");
      setLaunchPath(null);
      setSearching(false);
      setSaving(false);
      setSearchResults([]);
      setResultsOpen(false);
      setManualBangumiId("");
      setManualName("");
      setManualNameCn("");
      setManualLaunchPath("");
      setCoverSourcePath(null);
    }
  }, [open]);

  const coverPreviewUrl = useMemo(() => {
    if (!coverSourcePath) return null;
    return convertFileSrc(coverSourcePath);
  }, [coverSourcePath]);

  const busy = searching || saving || resultsOpen;

  function handleClose() {
    if (busy) return;
    onClose();
  }

  function handleResultsClose() {
    if (saving) return;
    setResultsOpen(false);
    setSearchResults([]);
  }

  async function handlePickBangumiLaunchExe() {
    const selected = await pickFileAtDefault("选择启动程序", [
      { name: "可执行文件", extensions: ["exe"] },
    ]);

    if (typeof selected === "string") {
      setLaunchPath(selected);
      setGameQuery(guessGameNameFromLaunchPath(selected));
    }
  }

  async function handlePickManualLaunchExe() {
    const selected = await pickFileAtDefault("选择启动程序", [
      { name: "可执行文件", extensions: ["exe"] },
    ]);

    if (typeof selected === "string") {
      setManualLaunchPath(selected);
      const guessed = guessGameNameFromLaunchPath(selected);
      if (!manualName.trim() && !manualNameCn.trim()) {
        setManualName(guessed);
      }
    }
  }

  async function handlePickCover() {
    const selected = await pickFileAtDefault("选择封面图片", [
      { name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
    ]);

    if (typeof selected === "string") {
      setCoverSourcePath(selected);
    }
  }

  async function handleBangumiConfirm() {
    const keyword = gameQuery.trim();
    if (!launchPath || !keyword) return;

    setSearching(true);
    try {
      const subjects = await searchSubjects(keyword);

      if (subjects.length === 0) {
        MessagePlugin.warning("未找到相关条目");
        return;
      }

      setSearchResults(subjects);
      setResultsOpen(true);
    } catch (err) {
      MessagePlugin.error(toErrorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectSubject(subject: BangumiSearchSubject) {
    if (!launchPath || saving) return;

    setSaving(true);
    const loadingId = MessagePlugin.loading("正在导入游戏数据…");
    try {
      const saved = await saveLibraryGameFromSubject(subject, launchPath);
      let partial = false;
      try {
        await ensureLibraryGameCharacters(saved.id, subject.id);
      } catch {
        partial = true;
      }
      const relationsOk = await ensureLibraryGameRelations(saved.id, subject.id);
      if (!relationsOk) partial = true;
      MessagePlugin.close(loadingId);
      if (partial) {
        MessagePlugin.warning("已保存到本地库，但角色或关联同步未完整");
      } else {
        MessagePlugin.success("已保存到本地库");
      }
      setResultsOpen(false);
      setSearchResults([]);
      onSaved?.();
      onClose();
    } catch (err) {
      MessagePlugin.close(loadingId);
      MessagePlugin.error(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleManualConfirm() {
    if (saving) return;

    const nextName = manualName.trim();
    const nextNameCn = manualNameCn.trim();
    const nextLaunchPath = manualLaunchPath.trim();

    if (!nextName && !nextNameCn) {
      MessagePlugin.warning("请填写游戏名");
      return;
    }
    if (!nextLaunchPath) {
      MessagePlugin.warning("请选择启动程序");
      return;
    }

    let bangumiId: number | null = null;
    const rawBangumiId = manualBangumiId.trim();
    if (rawBangumiId) {
      const parsed = Number.parseInt(rawBangumiId, 10);
      if (!Number.isFinite(parsed) || parsed === 0) {
        MessagePlugin.warning("请输入有效的 Bangumi ID");
        return;
      }
      bangumiId = parsed;
    }

    setSaving(true);
    try {
      const saved = await saveManualLibraryGame({
        bangumiId,
        name: nextName || nextNameCn,
        nameCn: nextNameCn,
        launchPath: nextLaunchPath,
        coverSourcePath,
      });
      let partial = false;
      if (bangumiId != null && bangumiId > 0) {
        try {
          await ensureLibraryGameCharacters(saved.id, bangumiId);
        } catch {
          partial = true;
        }
        const relationsOk = await ensureLibraryGameRelations(saved.id, bangumiId);
        if (!relationsOk) partial = true;
      }
      if (partial) {
        MessagePlugin.warning("已保存到本地库，但角色或关联同步未完整");
      } else {
        MessagePlugin.success("已保存到本地库");
      }
      onSaved?.();
      onClose();
    } catch (err) {
      MessagePlugin.error(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleClearBangumiLaunchPath() {
    setLaunchPath(null);
  }

  function handleClearManualLaunchPath() {
    setManualLaunchPath("");
  }

  function handleClearCoverChange() {
    setCoverSourcePath(null);
  }

  function handleManualBangumiIdChange(event: ChangeEvent<HTMLInputElement>) {
    setManualBangumiId(event.target.value);
  }

  function handleTabChange(key: string) {
    if (busy) return;
    setTab(key as ImportTab);
  }

  const bangumiConfirmDisabled =
    searching || saving || !launchPath || !gameQuery.trim();
  const manualConfirmDisabled =
    saving ||
    (!manualName.trim() && !manualNameCn.trim()) ||
    !manualLaunchPath.trim();

  return (
    <>
      <Dialog
        open={open}
        title="单个导入"
        className={
          tab === "manual" ? "edit-game-dialog single-import-dialog" : undefined
        }
        onClose={handleClose}
        onConfirm={tab === "bangumi" ? handleBangumiConfirm : handleManualConfirm}
        confirmText={tab === "bangumi" ? "确认" : "保存"}
        confirmDisabled={
          tab === "bangumi" ? bangumiConfirmDisabled : manualConfirmDisabled
        }
        confirmLoading={tab === "bangumi" ? searching : saving}
        content={
          <div className="library-add-form">
            <Tabs
              className="library-add-tabs"
              items={[...IMPORT_TABS]}
              value={tab}
              onChange={handleTabChange}
              aria-label="导入方式"
            />

            {tab === "bangumi" ? (
              <>
                <div className="library-add-launch">
                  <Button
                    theme="primary"
                    round
                    prefix={<SelectAppIcon aria-hidden />}
                    content="选择启动程序"
                    disabled={searching || saving}
                    onClick={handlePickBangumiLaunchExe}
                  />
                  {launchPath ? (
                    <div className="library-add-launch-path">
                      <span
                        className="library-add-launch-path-text"
                        title={launchPath}
                      >
                        {launchPath}
                      </span>
                      <button
                        type="button"
                        className="library-add-launch-path-clear"
                        aria-label="清除启动程序"
                        disabled={searching || saving}
                        onClick={handleClearBangumiLaunchPath}
                      >
                        <CloseIcon aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </div>
                <Input
                  value={gameQuery}
                  onChange={(e) => setGameQuery(e.target.value)}
                  placeholder="游戏名称 / 游戏ID"
                  aria-label="游戏名称或游戏ID"
                  disabled={searching || saving}
                />
              </>
            ) : (
              <div className="edit-game-form">
                <div className="edit-game-field">
                  <span className="edit-game-label">封面</span>
                  <div className="edit-game-cover">
                    <div className="edit-game-cover-preview">
                      {coverPreviewUrl ? (
                        <img
                          src={coverPreviewUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="edit-game-cover-empty">暂无封面</span>
                      )}
                    </div>
                    <div className="edit-game-cover-actions">
                      <Button
                        size="small"
                        round
                        content="选择封面"
                        disabled={saving}
                        onClick={handlePickCover}
                      />
                      {coverSourcePath ? (
                        <Button
                          size="small"
                          round
                          content="清除封面"
                          disabled={saving}
                          onClick={handleClearCoverChange}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                <label className="edit-game-field">
                  <span className="edit-game-label">Bangumi ID</span>
                  <Input
                    value={manualBangumiId}
                    onChange={handleManualBangumiIdChange}
                    placeholder="可选"
                    aria-label="Bangumi ID"
                    inputMode="numeric"
                    disabled={saving}
                  />
                </label>

                <label className="edit-game-field">
                  <span className="edit-game-label">原名</span>
                  <Input
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    placeholder="游戏原名"
                    aria-label="游戏原名"
                    disabled={saving}
                  />
                </label>

                <label className="edit-game-field">
                  <span className="edit-game-label">中文名</span>
                  <Input
                    value={manualNameCn}
                    onChange={(event) => setManualNameCn(event.target.value)}
                    placeholder="游戏中文名"
                    aria-label="游戏中文名"
                    disabled={saving}
                  />
                </label>

                <div className="edit-game-field">
                  <span className="edit-game-label">启动程序</span>
                  <div className="edit-game-launch">
                    <Button
                      theme="primary"
                      round
                      size="small"
                      prefix={<SelectAppIcon aria-hidden />}
                      content="选择启动程序"
                      disabled={saving}
                      onClick={handlePickManualLaunchExe}
                    />
                    {manualLaunchPath ? (
                      <div className="edit-game-launch-path">
                        <span
                          className="edit-game-launch-path-text"
                          title={manualLaunchPath}
                        >
                          {manualLaunchPath}
                        </span>
                        <button
                          type="button"
                          className="edit-game-launch-path-clear"
                          aria-label="清除启动程序"
                          disabled={saving}
                          onClick={handleClearManualLaunchPath}
                        >
                          <CloseIcon aria-hidden />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        }
      />
      <SearchResultsDialog
        open={resultsOpen}
        subjects={searchResults}
        selecting={saving}
        onClose={handleResultsClose}
        onSelect={handleSelectSubject}
      />
    </>
  );
}
