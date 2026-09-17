import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { CloseIcon, SelectAppIcon } from "@/components/icons";
import { Button } from "@/components/Button";
import { Dialog, DialogConfirm } from "@/components/Dialog";
import { Input } from "@/components/Input";
import { MessagePlugin } from "@/components/Message";
import {
  getSubjectById,
  type BangumiSearchSubject,
} from "@/features/bangumi";
import { toUpdateLibraryGameSubject, updateLibraryGame } from "../libraryStore";
import { resolveGameCoverUrl } from "../resolveGameCoverUrl";
import type { LibraryGame } from "../types";
import { toErrorMessage } from "@/utils/errorMessage";
import "./EditGameDialog.css";

export type EditGameDialogProps = {
  open: boolean;
  game: LibraryGame | null;
  onClose: () => void;
  onSaved?: (game: LibraryGame) => void;
};

function resolveSubjectCoverUrl(subject: BangumiSearchSubject) {
  return (
    subject.image ||
    subject.images?.large ||
    subject.images?.medium ||
    subject.images?.small ||
    null
  );
}

export function EditGameDialog({
  open,
  game,
  onClose,
  onSaved,
}: EditGameDialogProps) {
  const [bangumiId, setBangumiId] = useState("");
  const [name, setName] = useState("");
  const [nameCn, setNameCn] = useState("");
  const [launchPath, setLaunchPath] = useState("");
  const [coverSourcePath, setCoverSourcePath] = useState<string | null>(null);
  const [pendingSubject, setPendingSubject] =
    useState<BangumiSearchSubject | null>(null);

  const [resolvedBangumiId, setResolvedBangumiId] = useState<number | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCoverSourcePath(null);
      setPendingSubject(null);
      setResolvedBangumiId(null);
      setSaving(false);
      return;
    }
    if (!game) return;
    setBangumiId(String(game.bangumiId ?? ""));
    setName(game.name ?? "");
    setNameCn(game.nameCn ?? "");
    setLaunchPath(game.launchPath ?? "");
    setCoverSourcePath(null);
    setPendingSubject(null);
    setResolvedBangumiId(null);
    setSaving(false);
  }, [open, game]);

  const coverPreviewUrl = useMemo(() => {
    if (coverSourcePath) return convertFileSrc(coverSourcePath);
    if (pendingSubject) return resolveSubjectCoverUrl(pendingSubject);
    if (!game) return null;
    return resolveGameCoverUrl(game);
  }, [coverSourcePath, pendingSubject, game]);

  function handleClose() {
    if (saving) return;
    setCoverSourcePath(null);
    setPendingSubject(null);
    setResolvedBangumiId(null);
    setSaving(false);
    onClose();
  }

  async function handlePickLaunchExe() {
    const selected = await openDialog({
      title: "选择启动程序",
      multiple: false,
      directory: false,
      filters: [{ name: "可执行文件", extensions: ["exe"] }],
    });

    if (typeof selected === "string") {
      setLaunchPath(selected);
    }
  }

  async function handlePickCover() {
    const selected = await openDialog({
      title: "选择封面图片",
      multiple: false,
      directory: false,
      filters: [
        { name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
      ],
    });

    if (typeof selected === "string") {
      setCoverSourcePath(selected);
    }
  }

  async function fetchSubjectDraft(nextBangumiId: number) {
    const ok = await DialogConfirm({
      title: "按 ID 更新条目",
      content: `Bangumi ID 已从 ${game?.bangumiId} 变更为 ${nextBangumiId}。是否拉取新条目信息并更新编辑内容？`,
      confirmText: "按 ID 更新",
      onConfirm: async () => {
        try {
          const subject = await getSubjectById(nextBangumiId);
          setPendingSubject(subject);
          setResolvedBangumiId(subject.id);
          setBangumiId(String(subject.id));
          setName(subject.name ?? "");
          setNameCn(subject.name_cn ?? "");
          MessagePlugin.success("已加载新条目，请确认后再次保存");
        } catch (err) {
          MessagePlugin.error(
            toErrorMessage(err, "获取 Bangumi 条目失败"),
          );
          throw err;
        }
      },
    });
    if (!ok) {
      setPendingSubject(null);
      setResolvedBangumiId(nextBangumiId);
    }
  }

  async function handleSave() {
    if (!game || saving) return;

    const rawBangumiId = bangumiId.trim();
    const nextName = name.trim();
    const nextNameCn = nameCn.trim();
    const nextLaunchPath = launchPath.trim();

    let nextBangumiId: number;
    if (!rawBangumiId) {
      nextBangumiId = game.bangumiId;
    } else {
      nextBangumiId = Number.parseInt(rawBangumiId, 10);
      if (!Number.isFinite(nextBangumiId) || nextBangumiId === 0) {
        MessagePlugin.warning("请输入有效的 Bangumi ID");
        return;
      }
    }

    if (!nextName && !nextNameCn) {
      MessagePlugin.warning("请至少填写一个名称");
      return;
    }
    if (!nextLaunchPath) {
      MessagePlugin.warning("请选择启动程序");
      return;
    }

    const idChanged = nextBangumiId !== game.bangumiId;
    const pendingReady = pendingSubject?.id === nextBangumiId;
    const alreadyResolved = resolvedBangumiId === nextBangumiId;

    if (idChanged && nextBangumiId > 0 && !alreadyResolved) {
      await fetchSubjectDraft(nextBangumiId);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateLibraryGame({
        id: game.id,
        bangumiId: nextBangumiId,
        name: nextName || nextNameCn,
        nameCn: nextNameCn,
        launchPath: nextLaunchPath,
        coverSourcePath: coverSourcePath,
        subject:
          pendingReady && pendingSubject
            ? toUpdateLibraryGameSubject(pendingSubject)
            : null,
      });
      MessagePlugin.success("已保存游戏信息");
      onSaved?.(updated);
      onClose();
    } catch (err) {
      MessagePlugin.error(toErrorMessage(err, "保存失败"));
    } finally {
      setSaving(false);
    }
  }

  function handleClearCoverChange() {
    setCoverSourcePath(null);
  }

  function handleBangumiIdChange(event: ChangeEvent<HTMLInputElement>) {
    setBangumiId(event.target.value);
    setPendingSubject(null);
    setResolvedBangumiId(null);
  }

  function handleClearLaunchPath() {
    setLaunchPath("");
  }

  return (
    <Dialog
      open={open && game != null}
      title="编辑游戏"
      className="edit-game-dialog"
      confirmText="保存"
      confirmDisabled={
        saving ||
        (!name.trim() && !nameCn.trim()) ||
        !launchPath.trim()
      }
      confirmLoading={saving}
      onClose={handleClose}
      onConfirm={handleSave}
      content={
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
                  content="更换封面"
                  disabled={saving}
                  onClick={handlePickCover}
                />
                {coverSourcePath ? (
                  <Button
                    size="small"
                    round
                    content="撤销更换"
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
              value={bangumiId}
              onChange={handleBangumiIdChange}
              placeholder="可选"
              aria-label="Bangumi ID"
              inputMode="numeric"
              disabled={saving}
            />
          </label>

          <label className="edit-game-field">
            <span className="edit-game-label">原名</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="游戏原名"
              aria-label="游戏原名"
              disabled={saving}
            />
          </label>

          <label className="edit-game-field">
            <span className="edit-game-label">中文名</span>
            <Input
              value={nameCn}
              onChange={(event) => setNameCn(event.target.value)}
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
                content="重新选择"
                disabled={saving}
                onClick={handlePickLaunchExe}
              />
              {launchPath ? (
                <div className="edit-game-launch-path">
                  <span className="edit-game-launch-path-text" title={launchPath}>
                    {launchPath}
                  </span>
                  <button
                    type="button"
                    className="edit-game-launch-path-clear"
                    aria-label="清除启动程序"
                    disabled={saving}
                    onClick={handleClearLaunchPath}
                  >
                    <CloseIcon aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      }
    />
  );
}
