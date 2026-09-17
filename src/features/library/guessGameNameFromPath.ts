const GENERIC_EXE_NAMES = new Set(
  [
    "game",
    "start",
    "play",
    "run",
    "app",
    "main",
    "client",
    "startup",
    "boot",
    "bootstrap",
    "bootmenu",
    "config",
    "configure",
    "setting",
    "settings",
    "setup",
    "install",
    "installer",
    "uninstall",
    "uninst",
    "inst",
    "unins0",
    "unins00",
    "unins000",
    "update",
    "updater",
    "autoupdate",
    "patch",
    "patcher",
    "protect",
    "supporttools",
    "alpharom",
    "repair",
    "helper",
    "service",
    "watchdog",
    "crashreport",
    "crashpad",
    "unitycrashhandler",
    "unitycrashhandler32",
    "unitycrashhandler64",
    "unityplayer",
    "steam",
    "steam_api",
    "steam_api64",
    "dxwebsetup",
    "vcredist",
    "vcredist_x86",
    "vcredist_x64",
    "redist",
    "siglusengine",
    "siglus",
    "kirikiri",
    "krkr",
    "kag",
    "onscripter",
    "onscripter-en",
    "reallive",
    "lcsebody",
    "lcsebody32",
    "lcsebody64",
    "rugp",
    "willplus",
    "advhd",
    "chrysalis",
    "delfile",
    "filechk",
  ].map((name) => name.toLowerCase()),
);

const GENERIC_EXE_NAME_PARTS = new Set(
  ["bgi"].map((part) => part.toLowerCase()),
);

const GENERIC_NAME_PATTERN =
  /(?:^|[^a-z0-9])(setup|installer|uninstaller|updater|patcher|bootstrap|bootmenu|config|configure|settings?|autoupdate|protect|supporttools|alpharom)(?:$|[^a-z0-9])/i;

const EXCLUDED_LAUNCH_NAME_PARTS = [
  "unitycrashhandler32",
  "unitycrashhandler64",
  "unitycrashhandler",
  "protect",
  "ファイル破損チェック",
  "エンジン設定",
  "セーブファイル設定",
  "supporttools",
  "settings",
  "setting",
  "autoupdate",
  "unins000",
  "unins00",
  "unins0",
  "uninst",
  "inst",
  "configure",
  "config",
  "bootmenu",
  "bootstrap",
  "bgi",
  "patch",
  "alpharom",
  "注册表",
  "安装",
  "delfile",
  "filechk",
];

const PREFERRED_LAUNCH_NAME_PARTS = [
  "chs",
  "cn",
  "claude",
  "gpt",
  "汉化补丁",
];

function normalizeCandidate(name: string) {
  return name.trim().replace(/\.(exe|bat|cmd|lnk)$/i, "").trim();
}

function compactKey(name: string) {
  return name.toLowerCase().replace(/[\s_\-.'"`]+/g, "");
}

function hasGenericExeNamePart(key: string) {
  for (const part of GENERIC_EXE_NAME_PARTS) {
    if (key.includes(part)) return true;
  }
  return false;
}

function nameIncludesPart(name: string, part: string) {
  if (/[^\u0000-\u007f]/.test(part)) {
    return name.includes(part);
  }
  return name.toLowerCase().includes(part.toLowerCase());
}

function hasExcludedLaunchNamePart(name: string) {
  return EXCLUDED_LAUNCH_NAME_PARTS.some((part) =>
    nameIncludesPart(name, part),
  );
}

function preferredLaunchBonus(name: string) {
  let bonus = 0;
  for (const part of PREFERRED_LAUNCH_NAME_PARTS) {
    if (nameIncludesPart(name, part)) {
      if (part === "chs" || part === "汉化补丁") bonus += 220;
      else if (part === "cn") bonus += 180;
      else bonus += 200;
    }
  }
  return bonus;
}

function scoreLaunchExe(path: string) {
  const parts = splitPathParts(path);
  const fileName = parts[parts.length - 1] ?? "";
  const parentName = parts[parts.length - 2] ?? "";
  const fileTitle = normalizeCandidate(fileName);
  const parentTitle = normalizeCandidate(parentName);
  const fileKey = compactKey(fileTitle);
  const parentKey = compactKey(parentTitle);

  let score = 0;

  score += preferredLaunchBonus(fileTitle);

  if (isGalgameName(fileTitle) && !fileTitle.includes("_")) {
    score += 120;
  } else if (isGalgameName(fileTitle)) {
    score += 60;
  }

  if (fileKey && parentKey && fileKey === parentKey) {
    score += 100;
  } else if (
    fileKey &&
    parentKey &&
    (fileKey.includes(parentKey) || parentKey.includes(fileKey))
  ) {
    score += 40;
  }

  if (GENERIC_EXE_NAMES.has(fileKey)) {
    score -= 120;
  }
  if (hasExcludedLaunchNamePart(fileTitle)) {
    score -= 260;
  }
  if (GENERIC_NAME_PATTERN.test(fileTitle)) {
    score -= 90;
  }
  if (/^v?\d+(\.\d+)*$/i.test(fileTitle)) {
    score -= 100;
  }

  return score;
}

export function isExcludedLaunchExePath(path: string) {
  const fileTitle = normalizeCandidate(fileNameFromPath(path));
  const key = compactKey(fileTitle);
  return key === "delfile" || key === "filechk";
}

export function pickPreferredLaunchExe(exePaths: string[]) {
  if (exePaths.length === 0) return "";

  const preferred = exePaths.filter((path) => !isExcludedLaunchExePath(path));
  const pool = preferred.length > 0 ? preferred : exePaths;

  if (pool.length === 1) return pool[0] ?? "";

  let bestPath = pool[0] ?? "";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const path of pool) {
    const score = scoreLaunchExe(path);
    if (
      score > bestScore ||
      (score === bestScore &&
        path.localeCompare(bestPath, undefined, { sensitivity: "base" }) < 0)
    ) {
      bestScore = score;
      bestPath = path;
    }
  }

  return bestPath;
}

export function fileNameFromPath(path: string) {
  const parts = splitPathParts(path);
  return parts[parts.length - 1] ?? path;
}

export function isGalgameName(name: string) {
  const normalized = normalizeCandidate(name);
  if (!normalized) return false;

  const key = compactKey(normalized);
  if (!key) return false;
  if (GENERIC_EXE_NAMES.has(key)) return false;
  if (hasGenericExeNamePart(key)) return false;
  if (hasExcludedLaunchNamePart(normalized)) return false;
  if (/^v?\d+(\.\d+)*$/i.test(normalized)) return false;
  if (GENERIC_NAME_PATTERN.test(normalized)) return false;

  if (/^[a-z]{1,4}$/i.test(normalized)) return false;

  return true;
}

const WEAK_FOLDER_NAMES = new Set(
  [
    "game",
    "games",
    "bin",
    "app",
    "apps",
    "application",
    "release",
    "repack",
    "data",
    "soft",
    "software",
    "program",
    "programs",
    "desktop",
    "download",
    "downloads",
    "temp",
    "tmp",
    "newfolder",
    "新建文件夹",
    "新規フォルダ",
    "フォルダ",
  ].map((name) => name.toLowerCase()),
);

function isWeakFolderName(name: string) {
  const normalized = normalizeCandidate(name);
  if (!normalized) return true;

  const key = compactKey(normalized);
  if (!key) return true;
  if (WEAK_FOLDER_NAMES.has(key)) return true;
  if (GENERIC_EXE_NAMES.has(key)) return true;
  if (hasExcludedLaunchNamePart(normalized)) return true;
  if (/^v?\d+(\.\d+)*$/i.test(normalized)) return true;
  if (GENERIC_NAME_PATTERN.test(normalized)) return true;
  if (/^(new\s*folder|folder)(\s*\(\d+\))?$/i.test(normalized)) return true;

  if (/^\d+$/.test(key)) return true;

  if (/\d/.test(key) && /^[a-z0-9]+$/i.test(key)) {
    const letters = key.replace(/\d+/g, "");
    if (!letters) return true;
    if (letters.length <= 3 && key.length <= 12) return true;
    if (WEAK_FOLDER_NAMES.has(letters) || GENERIC_EXE_NAMES.has(letters)) {
      return true;
    }
  }

  return false;
}

export function splitPathParts(path: string) {
  return path.split(/[/\\]/).filter(Boolean);
}

export function guessGameNameFromLaunchPath(path: string) {
  const parts = splitPathParts(path);
  const fileName = parts[parts.length - 1] ?? "";
  const parentName = parts[parts.length - 2] ?? "";
  const fileTitle = normalizeCandidate(fileName);
  const parentTitle = normalizeCandidate(parentName);

  if (parentTitle && !isWeakFolderName(parentTitle)) {
    return parentTitle;
  }

  const exeMeaningful =
    Boolean(fileTitle) &&
    isGalgameName(fileTitle) &&
    !isWeakFolderName(fileTitle);

  if (exeMeaningful && !fileTitle.includes("_")) {
    return fileTitle;
  }

  if (exeMeaningful) {
    return fileTitle;
  }

  return parentTitle || fileTitle;
}
