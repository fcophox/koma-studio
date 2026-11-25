"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ensureAssetImage, getCachedImage, subscribeImages } from "../image-cache";

/** Devuelve la imagen del asset cuando está cargada (null mientras tanto). */
export function useAssetImage(assetId: string | null | undefined): HTMLImageElement | null {
  const image = useSyncExternalStore(
    subscribeImages,
    () => (assetId ? getCachedImage(assetId) : null),
    () => null,
  );

  useEffect(() => {
    if (assetId) void ensureAssetImage(assetId);
  }, [assetId]);

  return image;
}
