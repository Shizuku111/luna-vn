import { useEffect, useState } from "react";
import {
  ensureEntityImage,
  pickRemoteEntityImageUrl,
  resolveEntityImagePath,
  toImageVariant,
  toLocalImageSrc,
  type EntityImageKind,
  type EntityImageSources,
} from "./entityImageCache";

type UseCachedEntityImageOptions = {
  kind: EntityImageKind;
  id: number;
  images?: EntityImageSources;
  preferDetail?: boolean;
};

export function useCachedEntityImage({
  kind,
  id,
  images,
  preferDetail = false,
}: UseCachedEntityImageOptions): string | null {
  const variant = toImageVariant(preferDetail);
  const remoteUrl = pickRemoteEntityImageUrl(images, preferDetail);
  const [localSrc, setLocalSrc] = useState<string | null>(null);

  useEffect(() => {
    setLocalSrc(null);
  }, [kind, id, variant]);

  useEffect(() => {
    if (id <= 0) return;

    let cancelled = false;

    const ensurePromise = remoteUrl
      ? ensureEntityImage(kind, id, remoteUrl, variant)
      : Promise.resolve<string | null>(null);

    void (async () => {
      try {
        const existing = await resolveEntityImagePath(kind, id, variant);
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
  }, [kind, id, variant, remoteUrl]);

  return localSrc || remoteUrl;
}
