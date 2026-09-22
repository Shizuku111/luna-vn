import { useEffect, useState } from "react";
import {
  ensureEntityImage,
  pickRemoteEntityImageUrl,
  resolveEntityImagePath,
  toLocalImageSrc,
  type EntityImageKind,
  type EntityImageSources,
} from "./entityImageCache";

type UseCachedEntityImageOptions = {
  kind: EntityImageKind;
  id: number;
  images?: EntityImageSources;
};

export function useCachedEntityImage({
  kind,
  id,
  images,
}: UseCachedEntityImageOptions): string | null {
  const remoteUrl = pickRemoteEntityImageUrl(images);
  const [localSrc, setLocalSrc] = useState<string | null>(null);

  useEffect(() => {
    setLocalSrc(null);
  }, [kind, id]);

  useEffect(() => {
    if (id <= 0) return;

    let cancelled = false;

    const ensurePromise = remoteUrl
      ? ensureEntityImage(kind, id, remoteUrl)
      : Promise.resolve<string | null>(null);

    void (async () => {
      try {
        const existing = await resolveEntityImagePath(kind, id);
        if (!cancelled && existing) {
          setLocalSrc(toLocalImageSrc(existing));
        }

        const path = await ensurePromise;
        if (!cancelled && path) {
          setLocalSrc(toLocalImageSrc(path));
        }
      } catch {
        // keep remoteUrl fallback when local cache resolve fails
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, id, remoteUrl]);

  return localSrc || remoteUrl;
}
