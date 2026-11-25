"use client";

/**
 * Copiar / cortar / pegar la imagen de una viñeta.
 *
 * El contenido real vive en el store (`panelClipboard`); al portapapeles del
 * sistema solo se escribe un marcador de texto. Así, si después el usuario
 * copia una imagen en otra app/web, ese contenido "gana" al pegar, y si no,
 * se pega la viñeta copiada en Koma.
 *
 * Cada acción muestra un aviso breve para confirmar qué pasó.
 */
import { isAcceptedImage, useAssetStore } from "./store/asset-store";
import { useEditorStore } from "./store/editor-store";
import { modKeyLabel } from "./utils";

export const CLIPBOARD_MARKER = "koma-panel-image:";

function selectedPanel() {
  const { selection, project } = useEditorStore.getState();
  if (selection?.kind !== "panel") return null;
  const page = project?.pages.find((pg) => pg.id === selection.pageId);
  const index = page?.panels.findIndex((pn) => pn.id === selection.panelId) ?? -1;
  return index >= 0 && page ? { ...selection, number: index + 1, hasImage: !!page.panels[index].image } : null;
}

const toast = (message: string, extra?: { undo?: boolean; duration?: number }) => {
  const store = useEditorStore.getState();
  store.showToast({
    message,
    duration: extra?.duration ?? 3500,
    ...(extra?.undo ? { actionLabel: "Deshacer", onAction: () => useEditorStore.getState().undo() } : {}),
  });
};

/** Copia o corta la viñeta seleccionada. Devuelve el marcador o null si no se copió nada. */
export function copySelectedPanel(mode: "copy" | "cut"): string | null {
  const sel = selectedPanel();
  if (!sel) return null;
  if (!sel.hasImage) {
    toast(`La viñeta ${sel.number} está vacía: no hay imagen que ${mode === "cut" ? "cortar" : "copiar"}.`, {
      duration: 2500,
    });
    return null;
  }
  const store = useEditorStore.getState();
  if (!store.copyPanelImage(sel.pageId, sel.panelId, mode)) return null;
  const hint = `selecciona otra viñeta y pulsa ${modKeyLabel()}V`;
  if (mode === "cut") toast(`Imagen de la viñeta ${sel.number} cortada · ${hint}`, { undo: true, duration: 5000 });
  else toast(`Imagen de la viñeta ${sel.number} copiada · ${hint}`);
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
  const store = useEditorStore.getState();
  if (!store.panelClipboard) {
    toast("No hay ninguna imagen copiada. Selecciona una viñeta con imagen y pulsa " + `${modKeyLabel()}C.`, {
      duration: 3000,
    });
    return false;
  }
  const isReplacing = sel.hasImage;
  if (!store.pastePanelImage(sel.pageId, sel.panelId)) return false;
  toast(isReplacing ? `Imagen reemplazada en la viñeta ${sel.number}` : `Imagen pegada en la viñeta ${sel.number}`, {
    undo: true,
  });
  return true;
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
  toast(`Imagen del portapapeles pegada en la viñeta ${sel.number}`, { undo: true });
  return true;
}
