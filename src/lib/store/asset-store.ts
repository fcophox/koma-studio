"use client";

import { create } from "zustand";
import { addAsset, deleteAsset, listAssetMeta } from "../db";
import { forgetAssetImage } from "../image-cache";
import type { AssetMeta } from "../types";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const ACCEPT_ATTR = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

export function isAcceptedImage(file: File) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
}

interface AssetState {
  projectId: string | null;
  assets: AssetMeta[];
  importingCount: number;
  lastError: string | null;

  load: (projectId: string) => Promise<void>;
  reset: () => void;
  /** Guarda los archivos válidos en IndexedDB y devuelve sus metadatos. */
  importFiles: (files: File[], kind?: "library" | "character") => Promise<AssetMeta[]>;
  remove: (assetId: string) => Promise<void>;
}

export const useAssetStore = create<AssetState>()((set, get) => ({
  projectId: null,
  assets: [],
  importingCount: 0,
  lastError: null,

  load: async (projectId) => {
    set({ projectId, assets: [], lastError: null });
    const assets = await listAssetMeta(projectId);
    if (get().projectId === projectId) set({ assets });
  },

  reset: () => set({ projectId: null, assets: [], importingCount: 0, lastError: null }),

  importFiles: async (files, kind = "library") => {
    const { projectId } = get();
    if (!projectId) return [];
    const valid = files.filter(isAcceptedImage);
    const rejected = files.length - valid.length;
    if (valid.length === 0) {
      set({ lastError: rejected ? "Solo se admiten imágenes PNG, JPG o WEBP." : null });
      return [];
    }

    set((s) => ({ importingCount: s.importingCount + valid.length, lastError: null }));
    const results = await Promise.allSettled(valid.map((f) => addAsset(projectId, f, undefined, kind)));
    const added = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failed = results.length - added.length + rejected;

    set((s) => ({
      // Si el usuario cambió de proyecto mientras se importaba, no mezclar.
      assets: s.projectId === projectId ? [...s.assets, ...added] : s.assets,
      importingCount: Math.max(0, s.importingCount - valid.length),
      lastError: failed ? `${failed} archivo(s) no se pudieron importar.` : null,
    }));
    return added;
  },

  remove: async (assetId) => {
    await deleteAsset(assetId);
    forgetAssetImage(assetId);
    set((s) => ({ assets: s.assets.filter((a) => a.id !== assetId) }));
  },
}));

/** Tipo MIME del drag & drop interno (miniatura de asset → viñeta). */
export const ASSET_DRAG_MIME = "application/x-koma-asset";
