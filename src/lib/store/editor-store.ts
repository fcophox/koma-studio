"use client";

import { create } from "zustand";
import { applyTemplateToPage, cloneElement, clonePage, createPage } from "../factory";
import { getFormat } from "../formats";
import { boundingBox, mirrorNormalized, panelPolygon } from "../geometry";
import type {
  CanvasElement,
  Character,
  CharacterImage,
  Page,
  PageNumbering,
  PanelStyle,
  PlacedImage,
  Project,
  ReadingDirection,
  Selection,
} from "../types";

const HISTORY_LIMIT = 200;
const COALESCE_MS = 600;

/**
 * Parte del proyecto que entra en deshacer/rehacer: páginas y su maquetación.
 * Título, capítulo y personajes quedan fuera (se editan en formularios con su
 * propio deshacer de texto, y borrar un personaje elimina archivos).
 */
type DocState = Pick<Project, "pages" | "numbering" | "defaultStyle" | "readingDirection" | "formatId">;

interface HistoryEntry {
  doc: DocState;
  /** Página a mostrar al deshacer/rehacer este paso. */
  focusPageId: string | null;
  label: string;
}

interface History {
  past: HistoryEntry[];
  future: HistoryEntry[];
  lastKey?: string;
  lastAt?: number;
}

const EMPTY_HISTORY: History = { past: [], future: [] };

const docOf = (p: Project): DocState => ({
  pages: p.pages,
  numbering: p.numbering,
  defaultStyle: p.defaultStyle,
  readingDirection: p.readingDirection,
  formatId: p.formatId,
});

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Imagen copiada/cortada de una viñeta. El desplazamiento se guarda relativo
 * al tamaño de la viñeta de origen, así al pegarla en otra (aunque mida
 * distinto) queda en la misma posición proporcional.
 */
export interface PanelClipboard {
  id: string;
  mode: "copy" | "cut";
  assetId: string;
  offsetXRatio: number;
  offsetYRatio: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  sourcePageId: string;
  sourcePanelId: string;
}

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UpdateOptions {
  /** Registrar el estado previo en el historial (por defecto true). */
  record?: boolean;
  /** Descripción del paso ("Eliminar página 03"), visible en los tooltips. */
  label?: string;
  /**
   * Cambios consecutivos con la misma clave en menos de 600 ms se agrupan en
   * un único paso de deshacer (sliders, arrastres, nudges con teclado…).
   */
  coalesceKey?: string;
}

type ProjectMeta = Pick<Project, "title" | "chapterNumber" | "chapterTitle" | "formatId">;

export interface EditorState {
  project: Project | null;
  activePageId: string | null;
  selection: Selection;
  /** Viñeta cuya imagen se está encuadrando (pan/zoom/rotar con handles). */
  editingPanelId: string | null;
  /** Elemento (globo / onomatopeya) cuyo texto se edita en el lienzo. */
  editingTextId: string | null;
  panelClipboard: PanelClipboard | null;
  history: History;
  toast: Toast | null;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;

  loadProject: (project: Project) => void;
  closeProject: () => void;

  updateMeta: (patch: Partial<ProjectMeta>) => void;
  setReadingDirection: (dir: ReadingDirection) => void;
  setNumbering: (patch: Partial<PageNumbering>) => void;

  setActivePage: (pageId: string) => void;
  addPage: (templateId: string, afterPageId?: string) => void;
  duplicatePage: (pageId: string) => void;
  deletePage: (pageId: string) => void;
  movePage: (fromIndex: number, toIndex: number) => void;

  updatePage: (pageId: string, updater: (page: Page) => Page, opts?: UpdateOptions) => void;
  applyTemplate: (pageId: string, templateId: string) => void;
  setPageStyle: (pageId: string, patch: Partial<PanelStyle>, coalesceKey?: string) => void;
  applyStyleToAllPages: (pageId: string) => void;

  select: (selection: Selection) => void;
  deleteSelection: () => void;
  setEditingPanel: (panelId: string | null) => void;
  setEditingText: (elementId: string | null) => void;

  /** Copia o corta la imagen de una viñeta (con su encuadre). Devuelve false si está vacía. */
  copyPanelImage: (pageId: string, panelId: string, mode: "copy" | "cut") => boolean;
  /** Pega la imagen del portapapeles en una viñeta (reemplaza la que tenga). */
  pastePanelImage: (pageId: string, panelId: string) => boolean;
  clearPanelClipboard: () => void;

  addElement: (pageId: string, element: CanvasElement) => void;
  /** coalesceKey: null = paso de deshacer propio (acciones discretas como botones). */
  updateElement: (pageId: string, elementId: string, patch: Partial<CanvasElement>, coalesceKey?: string | null) => void;
  reorderElement: (pageId: string, elementId: string, to: "front" | "back" | "forward" | "backward") => void;
  duplicateElement: (pageId: string, elementId: string) => void;

  /** Asigna (o quita con null) la imagen de una viñeta, encuadrada en "cover". */
  setPanelImage: (pageId: string, panelId: string, assetId: string | null) => void;
  updatePanelImage: (
    pageId: string,
    panelId: string,
    patch: Partial<Omit<PlacedImage, "assetId">>,
    coalesceKey?: string | null,
  ) => void;

  undo: () => void;
  redo: () => void;
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: () => void;

  setSaveStatus: (status: SaveStatus, savedAt?: number) => void;

  // Personajes (nivel proyecto: se autoguardan, fuera del deshacer)
  addCharacter: (character: Character) => void;
  updateCharacter: (characterId: string, patch: Partial<Omit<Character, "id" | "images">>) => void;
  deleteCharacter: (characterId: string) => void;
  addCharacterImages: (characterId: string, images: CharacterImage[]) => void;
  updateCharacterImage: (characterId: string, imageId: string, patch: Partial<Omit<CharacterImage, "id">>) => void;
  removeCharacterImage: (characterId: string, imageId: string) => void;
}

export const useEditorStore = create<EditorState>()((set, get) => {
  /** Aplica una mutación al proyecto y actualiza updatedAt. */
  const mutate = (fn: (p: Project) => Project) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...fn(project), updatedAt: Date.now() } });
  };

  /** Mutación registrada en el historial global (deshacer/rehacer). */
  const commit = (
    fn: (p: Project) => Project,
    opts: { label: string; focusPageId?: string | null; coalesceKey?: string; record?: boolean },
  ) => {
    const { project, history, activePageId } = get();
    if (!project) return;
    const next = fn(project);
    if (next === project) return;

    let nextHistory = history;
    if (opts.record !== false) {
      const now = Date.now();
      const isCoalesced =
        !!opts.coalesceKey && history.lastKey === opts.coalesceKey && now - (history.lastAt ?? 0) < COALESCE_MS;
      const entry: HistoryEntry = {
        doc: docOf(project),
        focusPageId: opts.focusPageId === undefined ? activePageId : opts.focusPageId,
        label: opts.label,
      };
      nextHistory = {
        past: isCoalesced ? history.past : [...history.past, entry].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: opts.coalesceKey,
        lastAt: now,
      };
    }
    set({ project: { ...next, updatedAt: Date.now() }, history: nextHistory });
  };

  /** Página a mostrar tras deshacer/rehacer: la afectada, la actual o la primera. */
  const pickActive = (p: Project, preferred: string | null, current: string | null) =>
    [preferred, current].find((id) => id && p.pages.some((pg) => pg.id === id)) ?? p.pages[0]?.id ?? null;

  let toastSeq = 0;

  return {
    project: null,
    activePageId: null,
    selection: null,
    editingPanelId: null,
    editingTextId: null,
    panelClipboard: null,
    history: EMPTY_HISTORY,
    toast: null,
    saveStatus: "idle",
    lastSavedAt: null,

    loadProject: (project) =>
      set({
        project,
        activePageId: project.pages[0]?.id ?? null,
        selection: null,
        editingPanelId: null,
        editingTextId: null,
        history: EMPTY_HISTORY,
        toast: null,
        saveStatus: "saved",
        lastSavedAt: project.updatedAt,
      }),

    closeProject: () =>
      set({
        project: null,
        activePageId: null,
        selection: null,
        editingPanelId: null,
        editingTextId: null,
        history: EMPTY_HISTORY,
        toast: null,
        saveStatus: "idle",
      }),

    updateMeta: (patch) =>
      // El formato cambia la maquetación: va al historial. El resto (título…) no.
      patch.formatId !== undefined
        ? commit((p) => ({ ...p, ...patch }), { label: "Cambiar formato" })
        : mutate((p) => ({ ...p, ...patch })),

    setReadingDirection: (dir) =>
      commit((p) => {
        if (p.readingDirection === dir) return p;
        // Espejar la geometría existente: la viñeta 1 pasa al lado de inicio de lectura.
        const pages = p.pages.map((pg) => ({
          ...pg,
          panels: pg.panels.map((pn) => ({ ...pn, points: mirrorNormalized(pn.points) })),
        }));
        return { ...p, readingDirection: dir, pages };
      }, { label: "Cambiar dirección de lectura" }),

    setNumbering: (patch) =>
      commit((p) => ({ ...p, numbering: { ...p.numbering, ...patch } }), {
        label: "Numeración",
        coalesceKey: `numbering:${Object.keys(patch).join(",")}`,
      }),

    setActivePage: (pageId) =>
      set({ activePageId: pageId, selection: null, editingPanelId: null, editingTextId: null }),

    addPage: (templateId, afterPageId) => {
      const { project, activePageId } = get();
      if (!project) return;
      const page = createPage(templateId, project.readingDirection, project.defaultStyle);
      const anchor = afterPageId ?? activePageId;
      const idx = project.pages.findIndex((pg) => pg.id === anchor);
      const pages = [...project.pages];
      pages.splice(idx === -1 ? pages.length : idx + 1, 0, page);
      commit((p) => ({ ...p, pages }), { label: "Añadir página" });
      set({ activePageId: page.id, selection: null });
    },

    duplicatePage: (pageId) => {
      const { project } = get();
      if (!project) return;
      const idx = project.pages.findIndex((pg) => pg.id === pageId);
      if (idx === -1) return;
      const copy = clonePage(project.pages[idx]);
      const pages = [...project.pages];
      pages.splice(idx + 1, 0, copy);
      commit((p) => ({ ...p, pages }), { label: "Duplicar página", focusPageId: pageId });
      set({ activePageId: copy.id, selection: null });
    },

    deletePage: (pageId) => {
      const { project, activePageId } = get();
      if (!project || project.pages.length <= 1) return;
      const idx = project.pages.findIndex((pg) => pg.id === pageId);
      if (idx === -1) return;
      const pages = project.pages.filter((pg) => pg.id !== pageId);
      const nextActive = activePageId === pageId ? pages[Math.min(idx, pages.length - 1)].id : activePageId;
      const label = `Eliminar página ${String(project.numbering.startAt + idx).padStart(2, "0")}`;
      // focusPageId = la borrada: al deshacer se vuelve a mostrar.
      commit((p) => ({ ...p, pages }), { label, focusPageId: pageId });
      set({ activePageId: nextActive, selection: null, editingPanelId: null, editingTextId: null });
      get().showToast({ message: `${label.replace("Eliminar", "Eliminaste la")}`, actionLabel: "Deshacer", onAction: () => get().undo() });
    },

    movePage: (from, to) =>
      commit(
        (p) => {
          if (from === to || from < 0 || to < 0 || from >= p.pages.length || to >= p.pages.length) return p;
          const pages = [...p.pages];
          const [moved] = pages.splice(from, 1);
          pages.splice(to, 0, moved);
          return { ...p, pages };
        },
        { label: "Mover página", focusPageId: get().project?.pages[from]?.id ?? null },
      ),

    updatePage: (pageId, updater, opts = {}) =>
      commit(
        (p) => {
          const idx = p.pages.findIndex((pg) => pg.id === pageId);
          if (idx === -1) return p;
          const next = updater(p.pages[idx]);
          if (next === p.pages[idx]) return p;
          const pages = [...p.pages];
          pages[idx] = next;
          return { ...p, pages };
        },
        { label: opts.label ?? "Editar página", focusPageId: pageId, coalesceKey: opts.coalesceKey, record: opts.record },
      ),

    applyTemplate: (pageId, templateId) => {
      const { project } = get();
      if (!project) return;
      get().updatePage(
        pageId,
        (pg) => (pg.templateId === templateId ? pg : applyTemplateToPage(pg, templateId, project.readingDirection)),
        { label: "Cambiar plantilla" },
      );
      set({ selection: null });
    },

    setPageStyle: (pageId, patch, coalesceKey) =>
      get().updatePage(pageId, (pg) => ({ ...pg, style: { ...pg.style, ...patch } }), {
        label: "Estilo de viñetas",
        coalesceKey: coalesceKey ?? `style:${Object.keys(patch).join(",")}`,
      }),

    applyStyleToAllPages: (pageId) => {
      const { project } = get();
      const source = project?.pages.find((pg) => pg.id === pageId);
      if (!project || !source) return;
      // Un único paso de deshacer para todas las páginas.
      commit(
        (p) => ({
          ...p,
          defaultStyle: { ...source.style },
          pages: p.pages.map((pg) => (pg.id === pageId ? pg : { ...pg, style: { ...source.style } })),
        }),
        { label: "Aplicar estilo a todas", focusPageId: pageId },
      );
    },

    select: (selection) =>
      set((s) => ({
        selection,
        // Salir del modo encuadre al seleccionar otra cosa.
        editingPanelId:
          selection?.kind === "panel" && selection.panelId === s.editingPanelId ? s.editingPanelId : null,
        editingTextId:
          selection?.kind === "element" && selection.elementId === s.editingTextId ? s.editingTextId : null,
      })),

    copyPanelImage: (pageId, panelId, mode) => {
      const { project } = get();
      const page = project?.pages.find((pg) => pg.id === pageId);
      const panel = page?.panels.find((pn) => pn.id === panelId);
      if (!project || !page || !panel?.image) return false;
      const box = boundingBox(panelPolygon(panel, getFormat(project.formatId), page.style, page.bleed));
      const img = panel.image;
      set({
        panelClipboard: {
          id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          mode,
          assetId: img.assetId,
          offsetXRatio: img.offsetX / box.width,
          offsetYRatio: img.offsetY / box.height,
          scale: img.scale,
          rotation: img.rotation,
          flipX: img.flipX,
          sourcePageId: pageId,
          sourcePanelId: panelId,
        },
      });
      if (mode === "cut") {
        // Cortar vacía la viñeta ya (se puede deshacer con Cmd+Z).
        get().updatePage(
          pageId,
          (pg) => ({ ...pg, panels: pg.panels.map((pn) => (pn.id === panelId ? { ...pn, image: null } : pn)) }),
          { label: "Cortar imagen" },
        );
        if (get().editingPanelId === panelId) set({ editingPanelId: null });
      }
      return true;
    },

    pastePanelImage: (pageId, panelId) => {
      const { project, panelClipboard: clip } = get();
      const page = project?.pages.find((pg) => pg.id === pageId);
      const panel = page?.panels.find((pn) => pn.id === panelId);
      if (!project || !page || !panel || !clip) return false;
      const box = boundingBox(panelPolygon(panel, getFormat(project.formatId), page.style, page.bleed));
      get().updatePage(pageId, (pg) => ({
        ...pg,
        panels: pg.panels.map((pn) =>
          pn.id === panelId
            ? {
                ...pn,
                image: {
                  assetId: clip.assetId,
                  offsetX: clip.offsetXRatio * box.width,
                  offsetY: clip.offsetYRatio * box.height,
                  scale: clip.scale,
                  rotation: clip.rotation,
                  flipX: clip.flipX,
                },
              }
            : pn,
        ),
      }), { label: "Pegar imagen" });
      set({
        selection: { kind: "panel", pageId, panelId },
        editingPanelId: null,
        // Tras pegar un corte, el origen deja de marcarse; se puede seguir pegando.
        panelClipboard: clip.mode === "cut" ? { ...clip, mode: "copy", sourcePageId: "", sourcePanelId: "" } : clip,
      });
      return true;
    },

    clearPanelClipboard: () => set({ panelClipboard: null }),

    setEditingText: (elementId) => {
      const { activePageId } = get();
      if (!elementId || !activePageId) return set({ editingTextId: null });
      set({
        editingTextId: elementId,
        editingPanelId: null,
        selection: { kind: "element", pageId: activePageId, elementId },
      });
    },

    addElement: (pageId, element) => {
      get().updatePage(pageId, (pg) => ({ ...pg, elements: [...pg.elements, element] }), {
        label: element.type === "bubble" ? "Añadir globo" : "Añadir onomatopeya",
      });
      set({ selection: { kind: "element", pageId, elementId: element.id }, editingPanelId: null, editingTextId: null });
    },

    updateElement: (pageId, elementId, patch, coalesceKey) =>
      get().updatePage(
        pageId,
        (pg) => ({
          ...pg,
          elements: pg.elements.map((el) => (el.id === elementId ? ({ ...el, ...patch } as CanvasElement) : el)),
        }),
        {
          label: "Editar elemento",
          coalesceKey: coalesceKey === null ? undefined : (coalesceKey ?? `el:${elementId}:${Object.keys(patch).join(",")}`),
        },
      ),

    reorderElement: (pageId, elementId, to) =>
      get().updatePage(pageId, (pg) => {
        const idx = pg.elements.findIndex((el) => el.id === elementId);
        if (idx === -1) return pg;
        const last = pg.elements.length - 1;
        const target =
          to === "front" ? last : to === "back" ? 0 : to === "forward" ? Math.min(last, idx + 1) : Math.max(0, idx - 1);
        if (target === idx) return pg;
        const elements = [...pg.elements];
        const [moved] = elements.splice(idx, 1);
        elements.splice(target, 0, moved);
        return { ...pg, elements };
      }, { label: "Ordenar capas" }),

    duplicateElement: (pageId, elementId) => {
      const page = get().project?.pages.find((pg) => pg.id === pageId);
      const source = page?.elements.find((el) => el.id === elementId);
      if (source) get().addElement(pageId, cloneElement(source));
    },

    setEditingPanel: (panelId) => {
      const { project, activePageId } = get();
      const page = project?.pages.find((pg) => pg.id === activePageId);
      if (!panelId || !page) return set({ editingPanelId: null });
      const panel = page.panels.find((pn) => pn.id === panelId);
      if (!panel?.image) return;
      set({ editingPanelId: panelId, selection: { kind: "panel", pageId: page.id, panelId } });
    },

    setPanelImage: (pageId, panelId, assetId) => {
      get().updatePage(pageId, (pg) => ({
        ...pg,
        panels: pg.panels.map((pn) =>
          pn.id !== panelId
            ? pn
            : {
                ...pn,
                image: assetId
                  ? { assetId, offsetX: 0, offsetY: 0, scale: 1, rotation: 0, flipX: false }
                  : null,
              },
        ),
      }), { label: assetId ? "Colocar imagen" : "Quitar imagen" });
      if (!assetId && get().editingPanelId === panelId) set({ editingPanelId: null });
    },

    updatePanelImage: (pageId, panelId, patch, coalesceKey) =>
      get().updatePage(
        pageId,
        (pg) => ({
          ...pg,
          panels: pg.panels.map((pn) =>
            pn.id === panelId && pn.image ? { ...pn, image: { ...pn.image, ...patch } } : pn,
          ),
        }),
        {
          label: "Encuadrar imagen",
          coalesceKey:
            coalesceKey === null ? undefined : (coalesceKey ?? `image:${panelId}:${Object.keys(patch).join(",")}`),
        },
      ),

    deleteSelection: () => {
      const { selection } = get();
      if (!selection) return;
      if (selection.kind === "element") {
        get().updatePage(selection.pageId, (pg) => ({
          ...pg,
          elements: pg.elements.filter((el) => el.id !== selection.elementId),
        }), { label: "Eliminar elemento" });
        set({ selection: null, editingTextId: null });
        return;
      }
      // Viñeta: se vacía su imagen; la viñeta en sí pertenece a la plantilla.
      get().updatePage(selection.pageId, (pg) => {
        const target = pg.panels.find((pn) => pn.id === selection.panelId);
        if (!target?.image) return pg;
        return {
          ...pg,
          panels: pg.panels.map((pn) => (pn.id === selection.panelId ? { ...pn, image: null } : pn)),
        };
      }, { label: "Quitar imagen" });
    },

    undo: () => {
      const { project, history, activePageId } = get();
      const entry = history.past[history.past.length - 1];
      if (!project || !entry) return;
      const restored = { ...project, ...entry.doc, updatedAt: Date.now() };
      set({
        project: restored,
        activePageId: pickActive(restored, entry.focusPageId, activePageId),
        selection: null,
        editingPanelId: null,
        editingTextId: null,
        toast: null,
        history: {
          past: history.past.slice(0, -1),
          future: [{ ...entry, doc: docOf(project) }, ...history.future],
        },
      });
    },

    redo: () => {
      const { project, history, activePageId } = get();
      const [entry, ...rest] = history.future;
      if (!project || !entry) return;
      const restored = { ...project, ...entry.doc, updatedAt: Date.now() };
      set({
        project: restored,
        activePageId: pickActive(restored, entry.focusPageId, activePageId),
        selection: null,
        editingPanelId: null,
        editingTextId: null,
        history: { past: [...history.past, { ...entry, doc: docOf(project) }], future: rest },
      });
    },

    showToast: (toast) => set({ toast: { ...toast, id: ++toastSeq } }),
    dismissToast: () => set({ toast: null }),

    addCharacter: (character) => mutate((p) => ({ ...p, characters: [...p.characters, character] })),

    updateCharacter: (characterId, patch) =>
      mutate((p) => ({
        ...p,
        characters: p.characters.map((ch) => (ch.id === characterId ? { ...ch, ...patch } : ch)),
      })),

    deleteCharacter: (characterId) =>
      mutate((p) => ({ ...p, characters: p.characters.filter((ch) => ch.id !== characterId) })),

    addCharacterImages: (characterId, images) =>
      mutate((p) => ({
        ...p,
        characters: p.characters.map((ch) => (ch.id === characterId ? { ...ch, images: [...ch.images, ...images] } : ch)),
      })),

    updateCharacterImage: (characterId, imageId, patch) =>
      mutate((p) => ({
        ...p,
        characters: p.characters.map((ch) =>
          ch.id === characterId
            ? { ...ch, images: ch.images.map((img) => (img.id === imageId ? { ...img, ...patch } : img)) }
            : ch,
        ),
      })),

    removeCharacterImage: (characterId, imageId) =>
      mutate((p) => ({
        ...p,
        characters: p.characters.map((ch) =>
          ch.id === characterId ? { ...ch, images: ch.images.filter((img) => img.id !== imageId) } : ch,
        ),
      })),

    setSaveStatus: (status, savedAt) =>
      set((s) => ({ saveStatus: status, lastSavedAt: savedAt ?? s.lastSavedAt })),
  };
});

// ── Selectores ───────────────────────────────────────────────

export const selectActivePage = (s: EditorState): Page | null =>
  s.project?.pages.find((pg) => pg.id === s.activePageId) ?? null;

export const selectActivePageIndex = (s: EditorState): number =>
  s.project?.pages.findIndex((pg) => pg.id === s.activePageId) ?? -1;

export const selectCanUndo = (s: EditorState) => s.history.past.length > 0;

export const selectCanRedo = (s: EditorState) => s.history.future.length > 0;

/** Descripción del próximo paso a deshacer / rehacer (para tooltips). */
export const selectUndoLabel = (s: EditorState) => s.history.past[s.history.past.length - 1]?.label ?? null;

export const selectRedoLabel = (s: EditorState) => s.history.future[0]?.label ?? null;
