"use client";

/**
 * Copiar / cortar / pegar la imagen de una viñeta.
 *
 * El contenido real vive en el store (`panelClipboard`); al portapapeles del
 * sistema solo se escribe un marcador de texto. Así, si después el usuario
 * copia una imagen en otra app/web, ese contenido "gana" al pegar, y si no,
 * se pega la viñeta copiada en Koma.
 */
import { isAcceptedImage, useAssetStore } from "./store/asset-store";
import { useEditorStore } from "./store/editor-store";

export const CLIPBOARD_MARKER = "koma-panel-image:";

function selectedPanel() {
  const { selection } = useEditorStore.getState();
  return selection?.kind === "panel" ? selection : null;
}

/** Copia o corta la viñeta seleccionada. Devuelve el marcador o null si no había imagen. */
export function copySelectedPanel(mode: "copy" | "cut"): string | null {
  const sel = selectedPanel();
  if (!sel) return null;
  const store = useEditorStore.getState();
  if (!store.copyPanelImage(sel.pageId, sel.panelId, mode)) return null;
  return `${CLIPBOARD_MARKER}${useEditorStore.getState().panelClipboard!.id}`;
}

/** Versión para botones: también intenta dejar el marcador en el portapapeles del sistema. */
export function copySelectedPanelFromButton(mode: "copy" | "cut") {
  const marker = copySelectedPanel(mode);
  if (marker) void navigator.clipboard?.writeText(marker).catch(() => {});
  return !!marker;
}

export function pasteIntoSelectedPanel(): boolean {
  const sel = selectedPanel();
  if (!sel) return false;
  return useEditorStore.getState().pastePanelImage(sel.pageId, sel.panelId);
}

/** Pega una imagen que venga del portapapeles del sistema (copiada de una web, Finder…). */
export async function pasteFilesIntoSelectedPanel(files: File[]): Promise<boolean> {
  const sel = selectedPanel();
  const images = files.filter(isAcceptedImage);
  if (!sel || !images.length) return false;
  const [meta] = await useAssetStore.getState().importFiles([images[0]], "library");
  if (!meta) return false;
  const store = useEditorStore.getState();
  store.setPanelImage(sel.pageId, sel.panelId, meta.id);
  store.select({ kind: "panel", pageId: sel.pageId, panelId: sel.panelId });
  return true;
}
