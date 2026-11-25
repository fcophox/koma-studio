"use client";

import { create } from "zustand";
import { applyTemplateToPage, cloneElement, clonePage, createPage } from "../factory";
import { mirrorNormalized } from "../geometry";
import type {
  CanvasElement,
  Page,
  PageNumbering,
  PanelStyle,
  PlacedImage,
  Project,
  ReadingDirection,
  Selection,
} from "../types";

const HISTORY_LIMIT = 100;
const COALESCE_MS = 600;

interface PageHistory {
  past: Page[];
  future: Page[];
  lastKey?: string;
  lastAt?: number;
}

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UpdateOptions {
  /** Registrar el estado previo en el historial (por defecto true). */
  record?: boolean;
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
  history: Record<string, PageHistory>;
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

  setSaveStatus: (status: SaveStatus, savedAt?: number) => void;
}

export const useEditorStore = create<EditorState>()((set, get) => {
  /** Aplica una mutación al proyecto y actualiza updatedAt. */
  const mutate = (fn: (p: Project) => Project) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...fn(project), updatedAt: Date.now() } });
  };

  return {
    project: null,
    activePageId: null,
    selection: null,
    editingPanelId: null,
    editingTextId: null,
    history: {},
    saveStatus: "idle",
    lastSavedAt: null,

    loadProject: (project) =>
      set({
        project,
        activePageId: project.pages[0]?.id ?? null,
        selection: null,
        editingPanelId: null,
        editingTextId: null,
        history: {},
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
        history: {},
        saveStatus: "idle",
      }),

    updateMeta: (patch) => mutate((p) => ({ ...p, ...patch })),

    setReadingDirection: (dir) =>
      mutate((p) => {
        if (p.readingDirection === dir) return p;
        // Espejar la geometría existente: la viñeta 1 pasa al lado de inicio de lectura.
        const pages = p.pages.map((pg) => ({
          ...pg,
          panels: pg.panels.map((pn) => ({ ...pn, points: mirrorNormalized(pn.points) })),
        }));
        return { ...p, readingDirection: dir, pages };
      }),

    setNumbering: (patch) => mutate((p) => ({ ...p, numbering: { ...p.numbering, ...patch } })),

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
      mutate((p) => ({ ...p, pages }));
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
      mutate((p) => ({ ...p, pages }));
      set({ activePageId: copy.id, selection: null });
    },

    deletePage: (pageId) => {
      const { project, activePageId, history } = get();
      if (!project || project.pages.length <= 1) return;
      const idx = project.pages.findIndex((pg) => pg.id === pageId);
      if (idx === -1) return;
      const pages = project.pages.filter((pg) => pg.id !== pageId);
      const nextActive =
        activePageId === pageId ? pages[Math.min(idx, pages.length - 1)].id : activePageId;
      const { [pageId]: _removed, ...restHistory } = history;
      void _removed;
      mutate((p) => ({ ...p, pages }));
      set({ activePageId: nextActive, selection: null, history: restHistory });
    },

    movePage: (from, to) =>
      mutate((p) => {
        if (from === to || from < 0 || to < 0 || from >= p.pages.length || to >= p.pages.length) return p;
        const pages = [...p.pages];
        const [moved] = pages.splice(from, 1);
        pages.splice(to, 0, moved);
        return { ...p, pages };
      }),

    updatePage: (pageId, updater, opts = {}) => {
      const { project, history } = get();
      if (!project) return;
      const idx = project.pages.findIndex((pg) => pg.id === pageId);
      if (idx === -1) return;
      const prev = project.pages[idx];
      const next = updater(prev);
      if (next === prev) return;

      const record = opts.record ?? true;
      let nextHistory = history;
      if (record) {
        const h = history[pageId] ?? { past: [], future: [] };
        const now = Date.now();
        const coalesce =
          !!opts.coalesceKey && h.lastKey === opts.coalesceKey && now - (h.lastAt ?? 0) < COALESCE_MS;
        nextHistory = {
          ...history,
          [pageId]: {
            past: coalesce ? h.past : [...h.past, prev].slice(-HISTORY_LIMIT),
            future: [],
            lastKey: opts.coalesceKey,
            lastAt: now,
          },
        };
      }

      const pages = [...project.pages];
      pages[idx] = next;
      set({ project: { ...project, pages, updatedAt: Date.now() }, history: nextHistory });
    },

    applyTemplate: (pageId, templateId) => {
      const { project } = get();
      if (!project) return;
      get().updatePage(pageId, (pg) =>
        pg.templateId === templateId ? pg : applyTemplateToPage(pg, templateId, project.readingDirection),
      );
      set({ selection: null });
    },

    setPageStyle: (pageId, patch, coalesceKey) =>
      get().updatePage(pageId, (pg) => ({ ...pg, style: { ...pg.style, ...patch } }), {
        coalesceKey: coalesceKey ?? `style:${Object.keys(patch).join(",")}`,
      }),

    applyStyleToAllPages: (pageId) => {
      const { project } = get();
      const source = project?.pages.find((pg) => pg.id === pageId);
      if (!project || !source) return;
      // Cada página registra su propio paso de historial.
      project.pages.forEach((pg) => {
        if (pg.id !== pageId) get().updatePage(pg.id, (p) => ({ ...p, style: { ...source.style } }));
      });
      mutate((p) => ({ ...p, defaultStyle: { ...source.style } }));
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
      get().updatePage(pageId, (pg) => ({ ...pg, elements: [...pg.elements, element] }));
      set({ selection: { kind: "element", pageId, elementId: element.id }, editingPanelId: null, editingTextId: null });
    },

    updateElement: (pageId, elementId, patch, coalesceKey) =>
      get().updatePage(
        pageId,
        (pg) => ({
          ...pg,
          elements: pg.elements.map((el) => (el.id === elementId ? ({ ...el, ...patch } as CanvasElement) : el)),
        }),
        { coalesceKey: coalesceKey === null ? undefined : (coalesceKey ?? `el:${elementId}:${Object.keys(patch).join(",")}`) },
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
      }),

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
      }));
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
        }));
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
      });
    },

    undo: () => {
      const { project, activePageId, history } = get();
      if (!project || !activePageId) return;
      const h = history[activePageId];
      if (!h?.past.length) return;
      const idx = project.pages.findIndex((pg) => pg.id === activePageId);
      if (idx === -1) return;
      const current = project.pages[idx];
      const previous = h.past[h.past.length - 1];
      const pages = [...project.pages];
      pages[idx] = previous;
      set({
        project: { ...project, pages, updatedAt: Date.now() },
        selection: null,
        editingPanelId: null,
        editingTextId: null,
        history: {
          ...history,
          [activePageId]: { past: h.past.slice(0, -1), future: [current, ...h.future] },
        },
      });
    },

    redo: () => {
      const { project, activePageId, history } = get();
      if (!project || !activePageId) return;
      const h = history[activePageId];
      if (!h?.future.length) return;
      const idx = project.pages.findIndex((pg) => pg.id === activePageId);
      if (idx === -1) return;
      const current = project.pages[idx];
      const [next, ...rest] = h.future;
      const pages = [...project.pages];
      pages[idx] = next;
      set({
        project: { ...project, pages, updatedAt: Date.now() },
        selection: null,
        editingPanelId: null,
        editingTextId: null,
        history: { ...history, [activePageId]: { past: [...h.past, current], future: rest } },
      });
    },

    setSaveStatus: (status, savedAt) =>
      set((s) => ({ saveStatus: status, lastSavedAt: savedAt ?? s.lastSavedAt })),
  };
});

// ── Selectores ───────────────────────────────────────────────

export const selectActivePage = (s: EditorState): Page | null =>
  s.project?.pages.find((pg) => pg.id === s.activePageId) ?? null;

export const selectActivePageIndex = (s: EditorState): number =>
  s.project?.pages.findIndex((pg) => pg.id === s.activePageId) ?? -1;

export const selectCanUndo = (s: EditorState) =>
  !!s.activePageId && (s.history[s.activePageId]?.past.length ?? 0) > 0;

export const selectCanRedo = (s: EditorState) =>
  !!s.activePageId && (s.history[s.activePageId]?.future.length ?? 0) > 0;
