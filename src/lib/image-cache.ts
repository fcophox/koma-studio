"use client";

/**
 * Caché de HTMLImageElement por assetId, compartida por el lienzo Konva, las
 * miniaturas SVG y la exportación. Se expone como store externo para usarla
 * con useSyncExternalStore.
 */
import { getAssetUrl, revokeAssetUrl } from "./db";

const images = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeImages(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCachedImage(assetId: string): HTMLImageElement | null {
  return images.get(assetId) ?? null;
}

/** Carga (una sola vez) la imagen de un asset. Útil para esperar antes de exportar. */
export function ensureAssetImage(assetId: string): Promise<HTMLImageElement | null> {
  const cached = images.get(assetId);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(assetId);
  if (!p) {
    p = getAssetUrl(assetId).then(
      (url) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          if (!url) return resolve(null);
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            images.set(assetId, img);
            pending.delete(assetId);
            notify();
            resolve(img);
          };
          img.onerror = () => {
            pending.delete(assetId);
            resolve(null);
          };
          img.src = url;
        }),
    );
    pending.set(assetId, p);
  }
  return p;
}

export function forgetAssetImage(assetId: string) {
  images.delete(assetId);
  pending.delete(assetId);
  revokeAssetUrl(assetId);
  notify();
}
