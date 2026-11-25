import { nanoid } from "nanoid";
import { mirrorNormalized } from "./geometry";
import type { SfxPreset } from "./sfx-catalog";
import { DEFAULT_TEMPLATE_ID, getTemplate } from "./templates";
import {
  SCHEMA_VERSION,
  type BubbleKind,
  type CanvasElement,
  type OnomatopoeiaElement,
  type Page,
  type PageFormatId,
  type PanelSlot,
  type PanelStyle,
  type Project,
  type ReadingDirection,
  type SpeechBubble,
} from "./types";

export const newId = (prefix = "") => `${prefix}${nanoid(12)}`;

export const DEFAULT_PANEL_STYLE: PanelStyle = {
  borderWidth: 5,
  borderColor: "#111111",
  gutter: 22,
  margin: 48,
  pageBackground: "#ffffff",
  panelFill: "#ffffff",
};

export interface NewProjectInput {
  title: string;
  chapterNumber: number;
  chapterTitle: string;
  formatId: PageFormatId;
  readingDirection: ReadingDirection;
  initialPages?: number;
}

/** Crea las viñetas de una plantilla, espejadas si la lectura es RTL. */
export function panelsFromTemplate(templateId: string, direction: ReadingDirection): PanelSlot[] {
  const tpl = getTemplate(templateId);
  return tpl.panels.map((pts) => ({
    id: newId("pn_"),
    points: direction === "rtl" ? mirrorNormalized(pts) : [...pts],
    image: null,
  }));
}

export function createPage(
  templateId: string,
  direction: ReadingDirection,
  style: PanelStyle,
): Page {
  const tpl = getTemplate(templateId);
  return {
    id: newId("pg_"),
    templateId: tpl.id,
    bleed: !!tpl.bleed,
    panels: panelsFromTemplate(tpl.id, direction),
    elements: [],
    style: { ...style },
  };
}

/**
 * Cambia la plantilla de una página conservando las imágenes asignadas a los
 * índices que sigan existiendo.
 */
export function applyTemplateToPage(page: Page, templateId: string, direction: ReadingDirection): Page {
  const tpl = getTemplate(templateId);
  const panels = panelsFromTemplate(tpl.id, direction).map((slot, i) => ({
    ...slot,
    image: page.panels[i]?.image ?? null,
  }));
  return { ...page, templateId: tpl.id, bleed: !!tpl.bleed, panels };
}

export function createProject(input: NewProjectInput): Project {
  const now = Date.now();
  const count = Math.max(1, input.initialPages ?? 1);
  const pages = Array.from({ length: count }, (_, i) =>
    createPage(i === 0 && count > 1 ? "splash" : DEFAULT_TEMPLATE_ID, input.readingDirection, DEFAULT_PANEL_STYLE),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId("pj_"),
    title: input.title.trim() || "Sin título",
    chapterNumber: input.chapterNumber,
    chapterTitle: input.chapterTitle.trim(),
    formatId: input.formatId,
    readingDirection: input.readingDirection,
    numbering: {
      show: true,
      startAt: 1,
      position: "center",
      fontSize: 22,
      color: "#111111",
    },
    defaultStyle: { ...DEFAULT_PANEL_STYLE },
    pages,
    createdAt: now,
    updatedAt: now,
  };
}

/** Copia profunda de una página con IDs nuevos. */
export function clonePage(page: Page): Page {
  const copy: Page = structuredClone(page);
  copy.id = newId("pg_");
  copy.panels = copy.panels.map((p) => ({ ...p, id: newId("pn_") }));
  copy.elements = copy.elements.map((e) => ({ ...e, id: newId("el_") }));
  return copy;
}

/** Normaliza/migra proyectos leídos de IndexedDB. */
export function migrateProject(raw: Project): Project {
  const p = { ...raw };
  p.schemaVersion = SCHEMA_VERSION;
  p.defaultStyle = { ...DEFAULT_PANEL_STYLE, ...p.defaultStyle };
  p.pages = (p.pages ?? []).map((pg) => ({
    ...pg,
    bleed: pg.bleed ?? false,
    elements: (pg.elements ?? []).map((el) =>
      el.type === "sfx"
        ? { ...el, fontStyle: el.fontStyle ?? "normal", vertical: el.vertical ?? false }
        : { ...el, fontStyle: el.fontStyle ?? "bold" },
    ),
    style: { ...DEFAULT_PANEL_STYLE, ...pg.style },
  }));
  if (p.pages.length === 0) p.pages = [createPage(DEFAULT_TEMPLATE_ID, p.readingDirection, p.defaultStyle)];
  return p;
}

// ── Elementos libres: globos y onomatopeyas ──────────────────

const BUBBLE_DEFAULTS: Record<BubbleKind, Partial<SpeechBubble> & { width: number; height: number; text: string }> = {
  oval: { width: 300, height: 190, text: "¿Qué fue eso?" },
  thought: { width: 310, height: 210, text: "Algo no está bien…", fontStyle: "italic bold" },
  shout: { width: 340, height: 240, text: "¡¡CUIDADO!!", fontFamily: "bangers", fontStyle: "normal", fontSize: 34, strokeWidth: 3.5 },
  whisper: { width: 280, height: 170, text: "psst… por aquí", fontStyle: "italic", strokeWidth: 2.5, fontSize: 20 },
  narration: {
    width: 360,
    height: 110,
    text: "Mientras tanto, en la ciudad…",
    fill: "#fff8dc",
    fontStyle: "normal",
    fontSize: 20,
    align: "left",
  },
};

export function createBubble(kind: BubbleKind, x: number, y: number): SpeechBubble {
  const d = BUBBLE_DEFAULTS[kind];
  return {
    id: newId("el_"),
    type: "bubble",
    kind,
    x,
    y,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fontFamily: "comic-neue",
    fontStyle: "bold",
    fontSize: 24,
    lineHeight: 1.15,
    align: "center",
    textColor: "#111111",
    fill: "#ffffff",
    stroke: "#111111",
    strokeWidth: 3,
    ...d,
    tail: { enabled: kind !== "narration", tipX: -d.width * 0.3, tipY: d.height * 0.95 },
  };
}

export function createSfx(preset: SfxPreset, x: number, y: number): OnomatopoeiaElement {
  return {
    id: newId("el_"),
    type: "sfx",
    category: preset.category,
    text: preset.text,
    fontFamily: preset.fontId,
    fontStyle: preset.fontStyle ?? "normal",
    fontSize: preset.fontSize,
    fill: preset.fill,
    stroke: preset.stroke,
    strokeWidth: preset.strokeWidth,
    letterSpacing: preset.letterSpacing,
    skewX: preset.skewX,
    vertical: !!preset.vertical,
    x,
    y,
    rotation: preset.rotation,
    scaleX: 1,
    scaleY: 1,
  };
}

/** Onomatopeya nueva con texto propio y el estilo de otra (o de BOOM!). */
export function createCustomSfx(text: string, x: number, y: number, style?: OnomatopoeiaElement): OnomatopoeiaElement {
  const base: OnomatopoeiaElement = style ?? {
    ...createSfx(
      { id: "custom", category: "impact", text, fontId: "bangers", fontSize: 96, fill: "#ffd400", stroke: "#111111", strokeWidth: 9, rotation: -5, skewX: 0, letterSpacing: 2 },
      x,
      y,
    ),
  };
  return { ...base, id: newId("el_"), category: "custom", text, x, y };
}

export function cloneElement(el: CanvasElement, dx = 24, dy = 24): CanvasElement {
  return { ...structuredClone(el), id: newId("el_"), x: el.x + dx, y: el.y + dy };
}
