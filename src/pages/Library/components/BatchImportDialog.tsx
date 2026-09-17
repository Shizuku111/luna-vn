import {
  memo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { EditIcon, FolderIcon, MatchIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import type { BangumiSearchSubject } from "@/features/bangumi";
import {
  fileNameFromPath,
  isExcludedLaunchExePath,
} from "@/features/library";
import {
  useBatchImportController,
  type BatchImportRow,
  type BatchJobProgress,
} from "./useBatchImportController";
import "./BatchImportDialog.css";

function formatEta(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "计算中…";
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  if (totalSeconds < 60) return `约 ${totalSeconds} 秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `约 ${minutes} 分 ${seconds} 秒` : `约 ${minutes} 分`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0
    ? `约 ${hours} 小时 ${restMinutes} 分`
    : `约 ${hours} 小时`;
}

function resolveBatchEta(progress: BatchJobProgress) {
  if (progress.completed <= 0) return "计算中…";
  const remaining = Math.max(0, progress.total - progress.completed);
  if (remaining === 0) return "即将完成";
  const elapsed = Date.now() - progress.startedAt;
  const avg = elapsed / progress.completed;
  return formatEta(avg * remaining);
}

type BatchImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

const ROW_HEIGHT = 66;

function formatSubjectLabel(subject: BangumiSearchSubject) {
  return subject.name?.trim() || String(subject.id);
}

type BatchImportTableRowProps = {
  row: BatchImportRow;
  busy: boolean;
  style: CSSProperties;
  onEditSearchName: (row: BatchImportRow) => void;
  onOpenFolder: (row: BatchImportRow) => void;
  onMatchedGameChange: (rowId: string, bangumiId: string) => void;
  onLaunchPathChange: (rowId: string, launchPath: string) => void;
  onMatchOne: (row: BatchImportRow) => void;
  onImportOne: (row: BatchImportRow) => void;
  onRemoveRow: (rowId: string) => void;
};

const BatchImportTableRow = memo(function BatchImportTableRow({
  row,
  busy,
  style,
  onEditSearchName,
  onOpenFolder,
  onMatchedGameChange,
  onLaunchPathChange,
  onMatchOne,
  onImportOne,
  onRemoveRow,
}: BatchImportTableRowProps) {
  const launchName = fileNameFromPath(row.launchPath);
  const launchOptions = (() => {
    const filtered = row.exePaths.filter(
      (path) => !isExcludedLaunchExePath(path),
    );
    return filtered.length > 0 ? filtered : row.exePaths;
  })();
  const matchedSubject = row.matchCandidates.find(
    (subject) => subject.id === row.matchedBangumiId,
  );
  const rowBusy = row.status === "匹配中" || row.status === "导入中";
  const canMatch = row.status === "待匹配" || row.status === "匹配失败";
  const canImport = row.status === "已匹配" || row.status === "导入失败";
  const fieldsLocked = rowBusy || row.status === "已导入";

  return (
    <div className="library-batch-import-table-row" role="row" style={style}>
      <div className="library-batch-import-cell library-batch-import-search" role="cell">
        <div className="library-batch-import-search-row">
          <span
            className="library-batch-import-search-name"
            title={row.searchName}
          >
            {row.searchName}
          </span>
          <div className="library-batch-import-search-actions">
            <button
              type="button"
              className="library-batch-import-icon-btn"
              aria-label={`编辑搜索名称：${row.searchName}`}
              title="编辑搜索名称"
              disabled={fieldsLocked}
              onClick={() => onEditSearchName(row)}
            >
              <EditIcon aria-hidden />
            </button>
            <button
              type="button"
              className="library-batch-import-icon-btn"
              aria-label={`打开文件夹：${row.searchName}`}
              title="打开文件夹"
              onClick={() => onOpenFolder(row)}
            >
              <FolderIcon aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div className="library-batch-import-cell library-batch-import-matched" role="cell">
        {row.matchCandidates.length > 0 && row.matchedBangumiId != null ? (
          <Select
            className="library-batch-import-exe-select"
            size="small"
            value={String(row.matchedBangumiId)}
            title={
              matchedSubject ? formatSubjectLabel(matchedSubject) : undefined
            }
            disabled={fieldsLocked}
            options={row.matchCandidates.map((subject) => ({
              value: String(subject.id),
              label: formatSubjectLabel(subject),
            }))}
            onChange={(value) => onMatchedGameChange(row.id, value)}
          />
        ) : (
          <span>—</span>
        )}
      </div>

      <div className="library-batch-import-cell library-batch-import-launch" role="cell">
        {launchOptions.length > 1 ? (
          <Select
            className="library-batch-import-exe-select"
            size="small"
            value={row.launchPath}
            title={row.launchPath}
            disabled={fieldsLocked}
            options={launchOptions.map((path) => ({
              value: path,
              label: fileNameFromPath(path),
            }))}
            onChange={(value) => onLaunchPathChange(row.id, value)}
          />
        ) : (
          <span title={row.launchPath}>{launchName}</span>
        )}
      </div>

      <div
        className={[
          "library-batch-import-cell",
          "library-batch-import-status",
          row.status === "已匹配" || row.status === "已导入" ? "is-success" : "",
          row.status === "匹配失败" || row.status === "导入失败"
            ? "is-danger"
            : "",
          row.status === "匹配中" || row.status === "导入中" ? "is-pending" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="cell"
      >
        {row.status}
      </div>

      <div className="library-batch-import-cell library-batch-import-actions" role="cell">
        <div className="library-batch-import-action-group">
          {canMatch ? (
            <button
              type="button"
              className="library-batch-import-icon-btn"
              aria-label={`匹配：${row.searchName}`}
              title="匹配"
              disabled={busy}
              onClick={() => onMatchOne(row)}
            >
              <MatchIcon aria-hidden />
            </button>
          ) : null}
          {canImport ? (
            <button
              type="button"
              className="library-batch-import-icon-btn"
              aria-label={`导入：${row.searchName}`}
              title="导入"
              disabled={busy}
              onClick={() => onImportOne(row)}
            >
              <PlusIcon aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="library-batch-import-icon-btn is-danger"
            aria-label={`删除：${row.searchName}`}
            title="删除"
            disabled={rowBusy}
            onClick={() => onRemoveRow(row.id)}
          >
            <TrashIcon aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
});

export function BatchImportDialog({
  open,
  onClose,
  onSaved,
}: BatchImportDialogProps) {
  const {
    rootPath,
    rows,
    scanning,
    matching,
    importing,
    jobProgress,
    editingRowId,
    editingName,
    setEditingName,
    tableBodyRef,
    matchableCount,
    matchedCount,
    busy,
    handlePickRootFolder,
    handleLaunchPathChange,
    handleMatchedGameChange,
    handleOpenFolder,
    handleCloseEditSearchName,
    handleRemoveRow,
    handleOpenEditSearchName,
    handleSaveEditSearchName,
    handleEditSearchNameKeyDown,
    handleMatchOne,
    handleImportOne,
    handleMatchAll,
    handleImportAll,
    handleCancel,
    handleClose,
  } = useBatchImportController({ open, onClose, onSaved });

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableBodyRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  let bodyContent: ReactNode;
  if (!rootPath) {
    bodyContent = (
      <div className="library-batch-import-empty">选择根文件夹后开始扫描</div>
    );
  } else if (scanning) {
    bodyContent = <div className="library-batch-import-empty">正在扫描…</div>;
  } else if (rows.length === 0) {
    bodyContent = (
      <div className="library-batch-import-empty">未扫描到可导入的游戏</div>
    );
  } else {
    bodyContent = (
      <div
        className="library-batch-import-virtual"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map((item) => {
          const row = rows[item.index];
          if (!row) return null;
          return (
            <BatchImportTableRow
              key={row.id}
              row={row}
              busy={busy}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: item.size,
                transform: `translateY(${item.start}px)`,
              }}
              onEditSearchName={handleOpenEditSearchName}
              onOpenFolder={handleOpenFolder}
              onMatchedGameChange={handleMatchedGameChange}
              onLaunchPathChange={handleLaunchPathChange}
              onMatchOne={handleMatchOne}
              onImportOne={handleImportOne}
              onRemoveRow={handleRemoveRow}
            />
          );
        })}
      </div>
    );
  }

  const cancelLabel = matching
    ? "中止匹配"
    : importing
      ? "中止导入"
      : "取消";
  const showJobProgress =
    jobProgress != null && (matching || importing) && jobProgress.total > 0;
  const jobPercent = showJobProgress
    ? Math.min(
        100,
        Math.round((jobProgress.completed / jobProgress.total) * 100),
      )
    : 0;
  const jobRemaining = showJobProgress
    ? Math.max(0, jobProgress.total - jobProgress.completed)
    : 0;

  return (
    <>
      <Dialog
        open={open}
        title="批量导入"
        className="library-batch-import-dialog"
        onClose={handleClose}
        footer={
          <div className="library-batch-import-footer">
            <p className="library-batch-import-count">
              已扫描 {rootPath ? rows.length : 0} 款游戏
            </p>
            <div className="library-batch-import-footer-right">
              {showJobProgress ? (
                <div
                  className="library-batch-import-progress"
                  aria-label={
                    jobProgress.kind === "match" ? "匹配进度" : "导入进度"
                  }
                >
                  <div className="library-batch-import-progress-track">
                    <div
                      className="library-batch-import-progress-bar"
                      style={{ width: `${jobPercent}%` }}
                    />
                  </div>
                  <div className="library-batch-import-progress-meta">
                    <span>预计 {resolveBatchEta(jobProgress)}</span>
                    <span>成功 {jobProgress.success}</span>
                    <span>失败 {jobProgress.failed}</span>
                    <span>剩余 {jobRemaining}</span>
                  </div>
                </div>
              ) : null}
              <div className="library-batch-import-footer-actions">
                <Button round content={cancelLabel} onClick={handleCancel} />
                <Button
                  className="library-batch-import-match-btn"
                  round
                  content={`匹配游戏数据(${matchableCount})`}
                  disabled={busy || matchableCount === 0}
                  prefix={<MatchIcon aria-hidden />}
                  onClick={handleMatchAll}
                />
                <Button
                  className="library-batch-import-import-btn"
                  theme="primary"
                  round
                  content={`导入已匹配(${matchedCount})`}
                  disabled={busy || matchedCount === 0}
                  prefix={<PlusIcon aria-hidden />}
                  onClick={handleImportAll}
                />
              </div>
            </div>
          </div>
        }
        content={
          <div className="library-batch-import">
            <div className="library-batch-import-toolbar">
              <Button
                theme="primary"
                round
                prefix={<FolderIcon aria-hidden />}
                content="选择根文件夹"
                disabled={busy}
                onClick={handlePickRootFolder}
              />
              {rootPath ? (
                <span className="library-batch-import-root" title={rootPath}>
                  {rootPath}
                </span>
              ) : null}
            </div>

            <div className="library-batch-import-table-shell" role="table">
              <div className="library-batch-import-table-header" role="row">
                <div role="columnheader">搜索名称</div>
                <div role="columnheader">匹配的游戏</div>
                <div role="columnheader">启动程序</div>
                <div role="columnheader">状态</div>
                <div role="columnheader">操作</div>
              </div>
              <div
                ref={tableBodyRef}
                className="library-batch-import-table-body"
                role="rowgroup"
              >
                {bodyContent}
              </div>
            </div>
          </div>
        }
      />

      <Dialog
        open={editingRowId != null}
        title="编辑搜索名称"
        className="library-batch-import-edit-dialog"
        confirmText="保存"
        confirmDisabled={!editingName.trim()}
        onClose={handleCloseEditSearchName}
        onConfirm={handleSaveEditSearchName}
        content={
          <Input
            value={editingName}
            onChange={(event) => setEditingName(event.target.value)}
            placeholder="搜索名称"
            aria-label="搜索名称"
            autoFocus
            onKeyDown={handleEditSearchNameKeyDown}
          />
        }
      />
    </>
  );
}
