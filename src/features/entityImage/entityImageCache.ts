import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export type EntityImageKind = "character" | "person";

export type EntityImageVariant = "list" | "detail";

export type EntityImageSources = {
  large?: string;
  medium?: string;
  common?: string;
  small?: string;
  grid?: string;
} | null;

const MAX_ENSURE_CONCURRENT = 2;

type Semaphore = {
  active: number;
  waiters: Array<() => void>;
};

const ensureSemaphores: Record<EntityImageKind, Semaphore> = {
  character: { active: 0, waiters: [] },
  person: { active: 0, waiters: [] },
};

const ensureInflight = new Map<string, Promise<string | null>>();

function cacheKey(kind: EntityImageKind, id: number, variant: EntityImageVariant) {
  return `${kind}:${variant}:${id}`;
}

function acquireEnsureSlot(kind: EntityImageKind): Promise<void> {
  const sem = ensureSemaphores[kind];
  if (sem.active < MAX_ENSURE_CONCURRENT) {
    sem.active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    sem.waiters.push(resolve);
  });
}

function releaseEnsureSlot(kind: EntityImageKind) {
  const sem = ensureSemaphores[kind];
  const next = sem.waiters.shift();
  if (next) {
    next();
    return;
  }
  sem.active = Math.max(0, sem.active - 1);
}

export function toImageVariant(preferDetail: boolean): EntityImageVariant {
  return preferDetail ? "detail" : "list";
}

export function pickRemoteEntityImageUrl(
  images?: EntityImageSources,
  preferDetail = false,
): string | null {
  if (!images || typeof images !== "object") return null;
  if (preferDetail) {
    return (
      images.large ||
      images.medium ||
      images.common ||
      images.small ||
      images.grid ||
      null
    );
  }
  return (
    images.medium ||
    images.small ||
    images.common ||
    images.grid ||
    images.large ||
    null
  );
}

export async function resolveEntityImagePath(
  kind: EntityImageKind,
  id: number,
  variant: EntityImageVariant = "list",
): Promise<string | null> {
  if (id <= 0) return null;
  const path = await invoke<string | null>("resolve_entity_image", {
    kind,
    id,
    variant,
  });
  return path?.trim() || null;
}

export async function ensureEntityImage(
  kind: EntityImageKind,
  id: number,
  remoteUrl?: string | null,
  variant: EntityImageVariant = "list",
): Promise<string | null> {
  if (id <= 0) return null;
  const url = remoteUrl?.trim() || null;
  if (!url) return null;

  const key = cacheKey(kind, id, variant);
  const existing = ensureInflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    await acquireEnsureSlot(kind);
    try {
      const path = await invoke<string | null>("ensure_entity_image", {
        input: {
          kind,
          id,
          remoteUrl: url,
          variant,
        },
      });
      return path?.trim() || null;
    } finally {
      releaseEnsureSlot(kind);
    }
  })().finally(() => {
    ensureInflight.delete(key);
  });

  ensureInflight.set(key, promise);
  return promise;
}

export function toLocalImageSrc(path: string | null | undefined): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  return convertFileSrc(trimmed);
}
