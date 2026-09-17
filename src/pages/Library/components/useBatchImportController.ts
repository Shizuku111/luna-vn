import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { DialogConfirm } from "@/components/Dialog";
import { MessagePlugin } from "@/components/Message";
import {
  useBangumiController,
  type BangumiSearchSubject,
} from "@/features/bangumi";
import { ensureLibraryGameCharacters } from "@/features/character";
import {
  cancelBatchImportScan,
  ensureLibraryGameRelations,
  guessGameNameFromLaunchPath,
  pickPreferredLaunchExe,
  revealLibraryGame,
  saveLibraryGameFromSubject,
  scanBatchImportRoot,
} from "@/features/library";
import { toErrorMessage } from "@/utils/errorMessage";

export type BatchJobProgress = {
  kind: "match" | "import";
  total: number;
  completed: number;
  success: number;
  failed: number;
  startedAt: number;
};

export type BatchImportStatus =
  | "待匹配"
  | "匹配中"
  | "已匹配"
  | "匹配失败"
  | "导入中"
  | "已导入"
  | "导入失败";

export type BatchImportRow = {
  id: string;
  folderPath: string;
  searchName: string;
  matchCandidates: BangumiSearchSubject[];
  matchedBangumiId: number | null;
  exePaths: string[];
  launchPath: string;
  status: BatchImportStatus;
};

const MATCH_CONCURRENCY = 3;
const IMPORT_CONCURRENCY = 1;

function isScanCancelledError(err: unknown) {
  const message = toErrorMessage(err, "扫描失败");
  return message.includes("扫描已取消");
}

function createEmptyRow(
  folderPath: string,
  folderName: string,
  exePaths: string[],
  launchPath: string,
): BatchImportRow {
  return {
    id: folderPath,
    folderPath,
    searchName: guessGameNameFromLaunchPath(launchPath) || folderName,
    matchCandidates: [],
    matchedBangumiId: null,
    exePaths,
    launchPath,
    status: "待匹配",
  };
}

type UseBatchImportControllerArgs = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function useBatchImportController({
  open,
  onClose,
  onSaved,
}: UseBatchImportControllerArgs) {
  const { searchSubjects } = useBangumiController();
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [rows, setRows] = useState<BatchImportRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [matching, setMatching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [jobProgress, setJobProgress] = useState<BatchJobProgress | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const scanTokenRef = useRef(0);
  const matchTokenRef = useRef(0);
  const importTokenRef = useRef(0);
  const importStopRef = useRef(false);
  const rowsRef = useRef(rows);
  const scanningRef = useRef(scanning);
  const matchingRef = useRef(matching);
  const importingRef = useRef(importing);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  rowsRef.current = rows;
  scanningRef.current = scanning;
  matchingRef.current = matching;
  importingRef.current = importing;

  useEffect(() => {
    if (!open) {
      scanTokenRef.current += 1;
      matchTokenRef.current += 1;
      importTokenRef.current += 1;
      setRootPath(null);
      setRows([]);
      setScanning(false);
      setMatching(false);
      setImporting(false);
      setJobProgress(null);
      setEditingRowId(null);
      setEditingName("");
    }
  }, [open]);

  function patchRow(rowId: string, patch: Partial<BatchImportRow>) {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  }

  async function matchRow(
    row: BatchImportRow,
    token: number,
  ): Promise<"ok" | "fail"> {
    if (token !== matchTokenRef.current) return "fail";

    const keyword = row.searchName.trim();
    if (!keyword) {
      patchRow(row.id, {
        matchCandidates: [],
        matchedBangumiId: null,
        status: "匹配失败",
      });
      return "fail";
    }

    if (token !== matchTokenRef.current) return "fail";
    patchRow(row.id, { status: "匹配中" });

    try {
      const subjects = await searchSubjects(keyword);
      if (token !== matchTokenRef.current) return "fail";

      if (subjects.length === 0) {
        patchRow(row.id, {
          matchCandidates: [],
          matchedBangumiId: null,
          status: "匹配失败",
        });
        return "fail";
      }

      patchRow(row.id, {
        matchCandidates: subjects,
        matchedBangumiId: subjects[0]!.id,
        status: "已匹配",
      });
      return "ok";
    } catch {
      if (token !== matchTokenRef.current) return "fail";
      patchRow(row.id, {
        matchCandidates: [],
        matchedBangumiId: null,
        status: "匹配失败",
      });
      return "fail";
    }
  }

  async function matchRows(targets: BatchImportRow[]) {
    if (
      targets.length === 0 ||
      matchingRef.current ||
      scanningRef.current ||
      importingRef.current
    ) {
      return;
    }

    const token = ++matchTokenRef.current;
    setMatching(true);
    setJobProgress({
      kind: "match",
      total: targets.length,
      completed: 0,
      success: 0,
      failed: 0,
      startedAt: Date.now(),
    });

    try {
      let nextIndex = 0;

      async function worker() {
        while (nextIndex < targets.length) {
          if (token !== matchTokenRef.current) return;
          const index = nextIndex;
          nextIndex += 1;
          const target = targets[index];
          if (!target) continue;
          const latest =
            rowsRef.current.find((row) => row.id === target.id) ?? target;
          const result = await matchRow(latest, token);
          if (token !== matchTokenRef.current) return;
          setJobProgress((current) => {
            if (!current || current.kind !== "match") return current;
            return {
              ...current,
              completed: current.completed + 1,
              success: current.success + (result === "ok" ? 1 : 0),
              failed: current.failed + (result === "ok" ? 0 : 1),
            };
          });
        }
      }

      const workers = Array.from(
        { length: Math.min(MATCH_CONCURRENCY, targets.length) },
        () => worker(),
      );
      await Promise.all(workers);
    } finally {
      if (token === matchTokenRef.current) {
        setMatching(false);
        setJobProgress(null);
      }
    }
  }

  const matchRowsRef = useRef(matchRows);
  matchRowsRef.current = matchRows;

  async function importRow(
    row: BatchImportRow,
    token: number,
  ): Promise<"ok" | "partial" | "fail" | "skipped"> {
    if (token !== importTokenRef.current) return "skipped";

    const subject = row.matchCandidates.find(
      (item) => item.id === row.matchedBangumiId,
    );
    if (!subject || !row.launchPath.trim()) {
      patchRow(row.id, { status: "导入失败" });
      return "fail";
    }

    if (token !== importTokenRef.current) return "skipped";
    patchRow(row.id, { status: "导入中" });

    try {
      const saved = await saveLibraryGameFromSubject(subject, row.launchPath);
      let partial = false;
      try {
        await ensureLibraryGameCharacters(saved.id, subject.id);
      } catch {
        partial = true;
      }
      const relationsOk = await ensureLibraryGameRelations(saved.id, subject.id);
      if (!relationsOk) partial = true;
      if (token !== importTokenRef.current && !importStopRef.current) {
        return "skipped";
      }
      patchRow(row.id, { status: "已导入" });
      return partial ? "partial" : "ok";
    } catch {
      if (token !== importTokenRef.current && !importStopRef.current) {
        return "skipped";
      }
      patchRow(row.id, { status: "导入失败" });
      return "fail";
    }
  }

  async function importRows(targets: BatchImportRow[]) {
    if (
      targets.length === 0 ||
      matchingRef.current ||
      scanningRef.current ||
      importingRef.current
    ) {
      return;
    }

    const token = ++importTokenRef.current;
    importStopRef.current = false;
    setImporting(true);
    setJobProgress({
      kind: "import",
      total: targets.length,
      completed: 0,
      success: 0,
      failed: 0,
      startedAt: Date.now(),
    });
    let savedCount = 0;
    let failedCount = 0;
    let partialCount = 0;

    try {
      let nextIndex = 0;

      async function worker() {
        while (nextIndex < targets.length) {
          if (token !== importTokenRef.current) return;
          if (importStopRef.current) return;
          const index = nextIndex;
          nextIndex += 1;
          const target = targets[index];
          if (!target) continue;
          const latest =
            rowsRef.current.find((row) => row.id === target.id) ?? target;
          if (latest.status !== "已匹配" && latest.status !== "导入失败") {
            continue;
          }
          const result = await importRow(latest, token);
          if (result === "ok") savedCount += 1;
          if (result === "partial") {
            savedCount += 1;
            partialCount += 1;
          }
          if (result === "fail") failedCount += 1;
          if (token !== importTokenRef.current) return;
          setJobProgress((current) => {
            if (!current || current.kind !== "import") return current;
            const ok = result === "ok" || result === "partial";
            return {
              ...current,
              completed: current.completed + 1,
              success: current.success + (ok ? 1 : 0),
              failed: current.failed + (ok ? 0 : 1),
            };
          });
        }
      }

      const workers = Array.from(
        { length: Math.min(IMPORT_CONCURRENCY, targets.length) },
        () => worker(),
      );
      await Promise.all(workers);
    } finally {
      const softStopped = importStopRef.current;
      if (token === importTokenRef.current || softStopped) {
        setImporting(false);
        importingRef.current = false;
        setJobProgress(null);
        if (savedCount > 0) {
          onSaved?.();
        }
        if (savedCount > 0 || failedCount > 0 || softStopped) {
          const parts: string[] = [];
          if (savedCount > 0) {
            parts.push(
              savedCount === 1
                ? "已保存到本地库"
                : `已导入 ${savedCount} 款游戏到本地库`,
            );
          }
          if (partialCount > 0) {
            parts.push(`${partialCount} 款关联/角色未完整`);
          }
          if (failedCount > 0) {
            parts.push(`${failedCount} 款失败`);
          }
          if (softStopped) {
            parts.push("已中止后续导入");
          }
          const text = parts.join("，") || "已中止导入";
          if (failedCount > 0 || partialCount > 0 || softStopped) {
            MessagePlugin.warning(text);
          } else {
            MessagePlugin.success(text);
          }
        }
      }
    }
  }

  const importRowsRef = useRef(importRows);
  importRowsRef.current = importRows;

  async function scanRoot(path: string) {
    const token = ++scanTokenRef.current;
    matchTokenRef.current += 1;
    importTokenRef.current += 1;
    setMatching(false);
    setImporting(false);
    setJobProgress(null);
    setScanning(true);
    setRows([]);
    try {
      const items = await scanBatchImportRoot(path);
      if (token !== scanTokenRef.current) return;

      setRows(
        items.map((item) => {
          const launchPath = pickPreferredLaunchExe(item.exePaths);
          return createEmptyRow(
            item.folderPath,
            item.folderName,
            item.exePaths,
            launchPath,
          );
        }),
      );
    } catch (err) {
      if (token !== scanTokenRef.current) return;
      if (isScanCancelledError(err)) return;
      MessagePlugin.error(toErrorMessage(err, "扫描失败"));
      setRows([]);
    } finally {
      if (token === scanTokenRef.current) {
        setScanning(false);
      }
    }
  }

  async function handlePickRootFolder() {
    if (scanning || matching || importing) return;

    const selected = await openDialog({
      title: "选择根文件夹",
      multiple: false,
      directory: true,
    });

    if (typeof selected !== "string") return;

    setRootPath(selected);
    await scanRoot(selected);
  }

  const handleLaunchPathChange = useCallback(
    (rowId: string, launchPath: string) => {
      setRows((current) =>
        current.map((row) => {
          if (row.id !== rowId) return row;
          const nextSearchName =
            guessGameNameFromLaunchPath(launchPath) || row.searchName;
          const searchChanged = nextSearchName !== row.searchName;
          return {
            ...row,
            launchPath,
            searchName: nextSearchName,
            ...(searchChanged
              ? {
                  matchCandidates: [],
                  matchedBangumiId: null,
                  status: "待匹配" as const,
                }
              : null),
          };
        }),
      );
    },
    [],
  );

  const handleMatchedGameChange = useCallback(
    (rowId: string, bangumiId: string) => {
      const id = Number.parseInt(bangumiId, 10);
      if (!Number.isFinite(id)) return;
      setRows((current) =>
        current.map((row) =>
          row.id === rowId
            ? { ...row, matchedBangumiId: id, status: "已匹配" as const }
            : row,
        ),
      );
    },
    [],
  );

  const handleOpenFolder = useCallback((row: BatchImportRow) => {
    void (async () => {
      try {
        await revealLibraryGame(row.launchPath || row.folderPath);
      } catch (err) {
        MessagePlugin.error(toErrorMessage(err, "扫描失败") || "打开文件夹失败");
      }
    })();
  }, []);

  const handleCloseEditSearchName = useCallback(() => {
    setEditingRowId(null);
    setEditingName("");
  }, []);

  const handleRemoveRow = useCallback((rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
    setEditingRowId((current) => {
      if (current === rowId) {
        setEditingName("");
        return null;
      }
      return current;
    });
  }, []);

  const handleOpenEditSearchName = useCallback((row: BatchImportRow) => {
    if (
      row.status === "匹配中" ||
      row.status === "导入中" ||
      row.status === "已导入"
    ) {
      return;
    }
    setEditingRowId(row.id);
    setEditingName(row.searchName);
  }, []);

  function handleSaveEditSearchName() {
    if (!editingRowId) return;
    const nextName = editingName.trim();
    if (!nextName) {
      MessagePlugin.warning("请输入搜索名称");
      return;
    }
    setRows((current) =>
      current.map((row) =>
        row.id === editingRowId
          ? {
              ...row,
              searchName: nextName,
              matchCandidates: [],
              matchedBangumiId: null,
              status: "待匹配",
            }
          : row,
      ),
    );
    handleCloseEditSearchName();
  }

  function handleEditSearchNameKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleSaveEditSearchName();
  }

  const handleMatchOne = useCallback((row: BatchImportRow) => {
    void (async () => {
      if (
        matchingRef.current ||
        scanningRef.current ||
        importingRef.current
      ) {
        return;
      }
      const latest = rowsRef.current.find((item) => item.id === row.id) ?? row;
      if (latest.status === "匹配中" || latest.status === "导入中") return;
      await matchRowsRef.current([latest]);
    })();
  }, []);

  const handleImportOne = useCallback((row: BatchImportRow) => {
    void (async () => {
      if (
        matchingRef.current ||
        scanningRef.current ||
        importingRef.current
      ) {
        return;
      }
      const latest = rowsRef.current.find((item) => item.id === row.id) ?? row;
      if (latest.status !== "已匹配" && latest.status !== "导入失败") return;
      await importRowsRef.current([latest]);
    })();
  }, []);

  function handleMatchAll() {
    const targets = rows.filter(
      (row) => row.status === "待匹配" || row.status === "匹配失败",
    );
    if (targets.length === 0) {
      MessagePlugin.warning("没有需要匹配的游戏");
      return;
    }
    void matchRowsRef.current(targets);
  }

  function handleImportAll() {
    const targets = rows.filter(
      (row) => row.status === "已匹配" || row.status === "导入失败",
    );
    if (targets.length === 0) {
      MessagePlugin.warning("没有已匹配的游戏可导入");
      return;
    }
    void importRowsRef.current(targets);
  }

  function abortMatching() {
    if (!matchingRef.current) return;
    matchTokenRef.current += 1;
    matchingRef.current = false;
    setMatching(false);
    setJobProgress((current) =>
      current?.kind === "match" ? null : current,
    );
    setRows((current) =>
      current.map((row) =>
        row.status === "匹配中" ? { ...row, status: "待匹配" as const } : row,
      ),
    );
  }

  function abortImporting() {
    if (!importingRef.current) return;
    importStopRef.current = true;
  }

  function handleCancel() {
    if (matching) {
      abortMatching();
      return;
    }
    if (importing) {
      abortImporting();
      return;
    }
    handleClose();
  }

  function handleClose() {
    void (async () => {
      if (matchingRef.current || importingRef.current) {
        const action = matchingRef.current ? "匹配元数据" : "批量导入";
        const ok = await DialogConfirm({
          title: "中止并关闭",
          content: `当前正在${action}，确定要中止并关闭弹窗吗？`,
          confirmText: "中止并关闭",
          confirmTheme: "danger",
        });
        if (!ok) return;
      }
      closeDialog();
    })();
  }

  function closeDialog() {
    if (scanning) {
      scanTokenRef.current += 1;
      setScanning(false);
      void cancelBatchImportScan();
    }
    abortMatching();
    importTokenRef.current += 1;
    importStopRef.current = true;
    importingRef.current = false;
    setImporting(false);
    setJobProgress(null);
    onClose();
  }

  const matchableCount = rows.filter(
    (row) => row.status === "待匹配" || row.status === "匹配失败",
  ).length;
  const matchedCount = rows.filter(
    (row) => row.status === "已匹配" || row.status === "导入失败",
  ).length;
  const busy = scanning || matching || importing;

  return {
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
  };
}
