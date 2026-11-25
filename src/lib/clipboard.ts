"use client";

/**
 * Copiar / cortar / pegar: imagen de una viñeta o globo/onomatopeya.
 *
 * El contenido real vive en el store (`clipboard`, lo último copiado); al
 * portapapeles del sistema solo se escribe un marcador de texto. Así, si
 * después el usuario copia una imagen en otra app o web, esa imagen "gana" al
 * pegar en una viñeta, y si no, se pega lo copiado en Koma.
 *
 * Cada acción muestra un aviso breve para confirmar qué pasó.
 */
import { isAcceptedImage, useAssetStore } from "./store/asset-store";
import { useEditorStore } from "./store/editor-store";
import type { CanvasElement } from "./types";
import { modKeyLabel } from "./utils";

export const CLIPBOARD_MARKER = "koma-clip:";

const noun = (el: CanvasElement) => (el.type === "bubble" ? "Globo" : "Onomatopeya");

function selectedPanel() {
  const { selection, project } = useEditorStore.getState();
  if (selection?.kind !== "panel") return null;
  const page = project?.pages.find((pg) => pg.id === selection.pageId);
  const index = page?.panels.findIndex((pn) => pn.id === selection.panelId) ?? -1;
  return index >= 0 && page ? { ...selection, number: index + 1, hasImage: !!page.panels[index].image } : null;
}

function selectedElement() {
  const { selection, project } = useEditorStore.getState();
  if (selection?.kind !== "element") return null;
  const el = project?.pages.find((pg) => pg.id === selection.pageId)?.elements.find((e) => e.id === selection.elementId);
  return el ? { ...selection, element: el } : null;
}

const toast = (message: string, extra?: { undo?: boolean; duration?: number }) => {
  useEditorStore.getState().showToast({
    message,
    duration: extra?.duration ?? 3500,
    ...(extra?.undo ? { actionLabel: "Deshacer", onAction: () => useEditorStore.getState().undo() } : {}),
  });
};

/** ¿Hay algo seleccionado que se pueda copiar? */
export function hasCopyableSelection() {
  return !!(selectedPanel() || selectedElement());
}

/**
 * Copia o corta lo seleccionado (viñeta o globo/onomatopeya).
 * Devuelve el marcador para el portapapeles del sistema, o null si no se copió nada.
 */
export function copySelection(mode: "copy" | "cut"): string | null {
  const store = useEditorStore.getState();
  const verb = mode === "cut" ? "cortad" : "copiad";

  const el = selectedElement();
  if (el) {
    if (!store.copyElement(el.pageId, el.elementId, mode)) return null;
    const label = noun(el.element);
    const ending = label === "Globo" ? "o" : "a";
    toast(`${label} ${verb}${ending} · pulsa ${modKeyLabel()}V para pegarl${ending} (también en otra página)`, {
      undo: mode === "cut",
      duration: mode === "cut" ? 5000 : 3500,
    });
    return `${CLIPBOARD_MARKER}${useEditorStore.getState().clipboard!.id}`;
  }

  const sel = selectedPanel();
  if (!sel) return null;
  if (!sel.hasImage) {
    toast(`La viñeta ${sel.number} está vacía: no hay imagen que ${mode === "cut" ? "cortar" : "copiar"}.`, {
      duration: 2500,
    });
    return null;
  }
  if (!store.copyPanelImage(sel.pageId, sel.panelId, mode)) return null;
  toast(`Imagen de la viñeta ${sel.number} ${verb}a · selecciona otra viñeta y pulsa ${modKeyLabel()}V`, {
    undo: mode === "cut",
    duration: mode === "cut" ? 5000 : 3500,
  });
  return `${CLIPBOARD_MARKER}${useEditorStore.getState().clipboard!.id}`;
}

/** Versión para botones: también intenta dejar el marcador en el portapapeles del sistema. */
export function copySelectionFromButton(mode: "copy" | "cut") {
  const marker = copySelection(mode);
  if (marker) void navigator.clipboard?.writeText(marker).catch(() => {});
  return !!marker;
}

/** Pega lo último copiado: un globo en la página actual o una imagen en la viñeta seleccionada. */
export function pasteClipboard(): boolean {
  const store = useEditorStore.getState();
  const clip = store.clipboard;

  if (!clip) {
    toast(`No hay nada copiado. Selecciona una viñeta o un globo y pulsa ${modKeyLabel()}C.`, { duration: 3000 });
    return false;
  }

  if (clip.kind === "element") {
    if (!store.activePageId) return false;
    const pasted = store.pasteElement(store.activePageId);
    if (pasted) toast(`${noun(pasted)} pegad${pasted.type === "bubble" ? "o" : "a"}`, { undo: true });
    return !!pasted;
  }

  const sel = selectedPanel();
  if (!sel) {
    toast("Selecciona la viñeta donde quieres pegar la imagen.", { duration: 3000 });
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
