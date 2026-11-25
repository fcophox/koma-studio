"use client";

/**
 * Sincronización Zustand → IndexedDB.
 *
 * Se suscribe a los cambios de `project` (comparación por referencia; el store
 * es inmutable) y guarda con debounce. Se hace flush al ocultar la pestaña o
 * cerrar la página para no perder el último cambio.
 */
import { saveProject } from "../db";
import type { Project } from "../types";
import { useEditorStore } from "./editor-store";

const DEBOUNCE_MS = 450;

export function startAutosave() {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Project | null = null;
  let inflight: Promise<void> = Promise.resolve();

  const write = () => {
    if (!pending) return inflight;
    const snapshot = pending;
    pending = null;
    useEditorStore.getState().setSaveStatus("saving");
    inflight = inflight
      .then(() => saveProject(snapshot))
      .then(() => {
        if (!pending) useEditorStore.getState().setSaveStatus("saved", Date.now());
      })
      .catch((err) => {
        console.error("[autosave]", err);
        useEditorStore.getState().setSaveStatus("error");
      });
    return inflight;
  };

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    return write();
  };

  const unsubscribe = useEditorStore.subscribe((state, prev) => {
    if (!state.project || state.project === prev.project) return;
    // Cambió de proyecto (load) → no es una edición.
    if (prev.project?.id !== state.project.id) return;
    pending = state.project;
    if (state.saveStatus !== "saving") state.setSaveStatus("dirty");
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, DEBOUNCE_MS);
  });

  const onHide = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", onHide);

  return {
    flush,
    stop: () => {
      void flush();
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    },
  };
}
