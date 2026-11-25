"use client";

import { useEffect } from "react";
import {
  CLIPBOARD_MARKER,
  copySelection,
  copySelectionFromButton,
  hasCopyableSelection,
  pasteClipboard,
  pasteFilesIntoSelectedPanel,
} from "../clipboard";
import { useEditorStore } from "../store/editor-store";
import { isModalOpen, isTextEntryTarget, isTypingTarget } from "../utils";

/**
 * Atajos globales del editor. Zoom/pan (Espacio, Ctrl+0, rueda) viven en el
 * propio lienzo porque dependen de su viewport.
 */
export function useEditorShortcuts(isEnabled: boolean) {
  useEffect(() => {
    if (!isEnabled) return;

    /** Devuelve true si consumió la tecla. */
    const handleElementKey = (e: KeyboardEvent, key: string, mod: boolean) => {
      const store = useEditorStore.getState();
      if (store.selection?.kind !== "element") return false;
      const { pageId, elementId } = store.selection;
      const el = store.project?.pages.find((p) => p.id === pageId)?.elements.find((x) => x.id === elementId);
      if (!el) return false;

      if (mod && key === "d") {
        store.duplicateElement(pageId, elementId);
      } else if (mod && (e.code === "BracketRight" || e.key === "]" || e.key === "}")) {
        // e.code = tecla física: funciona también en teclados español/latam.
        store.reorderElement(pageId, elementId, e.shiftKey ? "front" : "forward");
      } else if (mod && (e.code === "BracketLeft" || e.key === "[" || e.key === "{")) {
        store.reorderElement(pageId, elementId, e.shiftKey ? "back" : "backward");
      } else if (key === "enter" && !(e.target instanceof HTMLButtonElement)) {
        store.setEditingText(elementId);
      } else if (key.startsWith("arrow") && !mod) {
        const step = e.shiftKey ? 10 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        store.updateElement(pageId, elementId, { x: el.x + dx, y: el.y + dy }, `el:${elementId}:nudge`);
      } else {
        return false;
      }
      e.preventDefault();
      return true;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen()) return;
      const mod = e.metaKey || e.ctrlKey;
      // Con Cmd/Ctrl solo se cede el atajo a campos de texto; un slider con foco
      // (p. ej. tras ajustar el zoom) no debe bloquear copiar/pegar/deshacer.
      if (mod ? isTextEntryTarget(e.target) : isTypingTarget(e.target)) return;
      const store = useEditorStore.getState();
      const key = e.key.toLowerCase();

      // Copiar/cortar/pegar (viñetas y globos): lo resuelven los eventos nativos
      // de abajo; si el navegador no los dispara (p. ej. Safari sin texto
      // seleccionado), este respaldo actúa en el siguiente tick.
      const isCopyKey = key === "c" || key === "x";
      const isClipboardShortcut =
        mod &&
        !e.altKey &&
        ((isCopyKey && hasCopyableSelection()) ||
          (key === "v" && (store.selection?.kind === "panel" || !!store.clipboard)));
      if (isClipboardShortcut) {
        if (window.getSelection()?.toString()) return;
        clipboardHandled = false;
        const mode = key === "x" ? "cut" : "copy";
        setTimeout(() => {
          if (clipboardHandled) return;
          if (key === "v") pasteClipboard();
          else copySelectionFromButton(mode);
        }, 60);
        return;
      }

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        store.redo();
      } else if (key === "delete" || key === "backspace") {
        if (store.selection) {
          e.preventDefault();
          store.deleteSelection();
        }
      } else if (key === "escape") {
        if (store.editingPanelId) store.setEditingPanel(null);
        else if (store.selection) store.select(null);
        else store.clearClipboard(); // segundo Esc: olvidar lo copiado
      } else if (store.selection?.kind === "element" && handleElementKey(e, key, mod)) {
        // Atajos de globos / onomatopeyas resueltos en handleElementKey.
      } else if (key === "enter" && store.selection?.kind === "panel" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        store.setEditingPanel(store.editingPanelId ? null : store.selection.panelId);
      } else if (key.startsWith("arrow") && store.selection?.kind === "panel") {
        // Nudge del encuadre de la imagen: 1u, o 10u con Shift.
        const { pageId, panelId } = store.selection;
        const panel = store.project?.pages.find((p) => p.id === pageId)?.panels.find((p) => p.id === panelId);
        if (!panel?.image) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        store.updatePanelImage(
          pageId,
          panelId,
          { offsetX: panel.image.offsetX + dx, offsetY: panel.image.offsetY + dy },
          `image:${panelId}:nudge`,
        );
      } else if (key === "pagedown" || key === "pageup") {
        const pages = store.project?.pages ?? [];
        const idx = pages.findIndex((p) => p.id === store.activePageId);
        const next = pages[idx + (key === "pagedown" ? 1 : -1)];
        if (next) {
          e.preventDefault();
          store.setActivePage(next.id);
        }
      }
    };

    // ── Copiar / cortar / pegar viñetas (eventos nativos del portapapeles) ──
    let clipboardHandled = false;
    const isOwnClipboardContext = () => {
      if (isModalOpen() || isTextEntryTarget(document.activeElement)) return false;
      // Si hay texto seleccionado en la interfaz, que Cmd+C copie ese texto.
      return !window.getSelection()?.toString();
    };

    const handleCopyOrCut = (e: ClipboardEvent) => {
      if (!isOwnClipboardContext() || !hasCopyableSelection()) return;
      clipboardHandled = true;
      const marker = copySelection(e.type === "cut" ? "cut" : "copy");
      if (!marker) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", marker);
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (!isOwnClipboardContext()) return;
      const { selection, clipboard } = useEditorStore.getState();
      const isPanelSelected = selection?.kind === "panel";
      if (!isPanelSelected && !clipboard) return;
      clipboardHandled = true;
      e.preventDefault();
      const files = Array.from(e.clipboardData?.files ?? []);
      const text = e.clipboardData?.getData("text/plain") ?? "";
      // Una imagen copiada fuera de Koma (más reciente que nuestro marcador) tiene prioridad.
      if (isPanelSelected && files.length && !text.startsWith(CLIPBOARD_MARKER)) {
        void pasteFilesIntoSelectedPanel(files);
        return;
      }
      pasteClipboard();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("copy", handleCopyOrCut);
    window.addEventListener("cut", handleCopyOrCut);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("copy", handleCopyOrCut);
      window.removeEventListener("cut", handleCopyOrCut);
      window.removeEventListener("paste", handlePaste);
    };
  }, [isEnabled]);
}
