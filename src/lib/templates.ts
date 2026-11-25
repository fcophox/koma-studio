/**
 * Biblioteca de plantillas de viñetas.
 *
 * Cada viñeta es un polígono convexo en coordenadas normalizadas (0..1) del
 * área útil, listado en orden de lectura occidental (izq → der, arriba → abajo).
 * Para lectura manga (RTL) se espejan al aplicarse, de modo que la viñeta 1
 * queda arriba a la derecha.
 */

export type TemplateCategory = "basic" | "grid" | "dynamic" | "action";

export interface PanelTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  bleed?: boolean;
  panels: number[][];
}

const rect = (x: number, y: number, w: number, h: number) => [
  x, y, x + w, y, x + w, y + h, x, y + h,
];

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, string> = {
  basic: "Básicas",
  grid: "Grids",
  dynamic: "Dinámicas",
  action: "Acción / Manga",
};

export const PANEL_TEMPLATES: PanelTemplate[] = [
  // ── Básicas ────────────────────────────────────────────────
  { id: "blank", name: "Página libre", category: "basic", panels: [] },
  { id: "splash", name: "Splash", category: "basic", panels: [rect(0, 0, 1, 1)] },
  {
    id: "splash-bleed",
    name: "Splash a sangre",
    category: "basic",
    bleed: true,
    panels: [rect(0, 0, 1, 1)],
  },
  {
    id: "two-rows",
    name: "2 filas",
    category: "basic",
    panels: [rect(0, 0, 1, 0.5), rect(0, 0.5, 1, 0.5)],
  },
  {
    id: "three-rows",
    name: "3 filas",
    category: "basic",
    panels: [rect(0, 0, 1, 1 / 3), rect(0, 1 / 3, 1, 1 / 3), rect(0, 2 / 3, 1, 1 / 3)],
  },
  {
    id: "two-cols",
    name: "2 columnas",
    category: "basic",
    panels: [rect(0, 0, 0.5, 1), rect(0.5, 0, 0.5, 1)],
  },

  // ── Grids ──────────────────────────────────────────────────
  {
    id: "grid-2x2",
    name: "Grid 2×2",
    category: "grid",
    panels: [rect(0, 0, 0.5, 0.5), rect(0.5, 0, 0.5, 0.5), rect(0, 0.5, 0.5, 0.5), rect(0.5, 0.5, 0.5, 0.5)],
  },
  {
    id: "grid-2x3",
    name: "Grid 2×3",
    category: "grid",
    panels: [
      rect(0, 0, 0.5, 1 / 3), rect(0.5, 0, 0.5, 1 / 3),
      rect(0, 1 / 3, 0.5, 1 / 3), rect(0.5, 1 / 3, 0.5, 1 / 3),
      rect(0, 2 / 3, 0.5, 1 / 3), rect(0.5, 2 / 3, 0.5, 1 / 3),
    ],
  },
  {
    id: "grid-3x3",
    name: "Grid 3×3",
    category: "grid",
    panels: [0, 1, 2].flatMap((r) =>
      [0, 1, 2].map((c) => rect(c / 3, r / 3, 1 / 3, 1 / 3)),
    ),
  },

  // ── Dinámicas ──────────────────────────────────────────────
  {
    id: "dynamic-4",
    name: "4 dinámica",
    category: "dynamic",
    panels: [rect(0, 0, 1, 0.3), rect(0, 0.3, 0.4, 0.35), rect(0.4, 0.3, 0.6, 0.35), rect(0, 0.65, 1, 0.35)],
  },
  {
    id: "dynamic-5",
    name: "5 dinámica",
    category: "dynamic",
    panels: [
      rect(0, 0, 0.6, 0.33), rect(0.6, 0, 0.4, 0.33),
      rect(0, 0.33, 1, 0.34),
      rect(0, 0.67, 0.4, 0.33), rect(0.4, 0.67, 0.6, 0.33),
    ],
  },
  {
    id: "dynamic-6",
    name: "6 dinámica",
    category: "dynamic",
    panels: [
      rect(0, 0, 0.5, 0.3), rect(0.5, 0, 0.5, 0.3),
      rect(0, 0.3, 1 / 3, 0.3), rect(1 / 3, 0.3, 1 / 3, 0.3), rect(2 / 3, 0.3, 1 / 3, 0.3),
      rect(0, 0.6, 1, 0.4),
    ],
  },
  {
    id: "feature-left",
    name: "Columna destacada",
    category: "dynamic",
    panels: [rect(0, 0, 0.55, 1), rect(0.55, 0, 0.45, 1 / 3), rect(0.55, 1 / 3, 0.45, 1 / 3), rect(0.55, 2 / 3, 0.45, 1 / 3)],
  },

  // ── Acción / manga ─────────────────────────────────────────
  {
    id: "action-diagonal-3",
    name: "Cortes diagonales",
    category: "action",
    panels: [
      [0, 0, 1, 0, 1, 0.28, 0, 0.4],
      [0, 0.4, 1, 0.28, 1, 0.62, 0, 0.72],
      [0, 0.72, 1, 0.62, 1, 1, 0, 1],
    ],
  },
  {
    id: "action-diagonal-4",
    name: "Impacto diagonal",
    category: "action",
    panels: [
      [0, 0, 1, 0, 1, 0.35, 0, 0.25],
      [0, 0.25, 0.6, 0.31, 0.4, 0.73, 0, 0.75],
      [0.6, 0.31, 1, 0.35, 1, 0.7, 0.4, 0.73],
      [0, 0.75, 1, 0.7, 1, 1, 0, 1],
    ],
  },
  {
    id: "action-shonen-5",
    name: "Shōnen 5",
    category: "action",
    panels: [
      [0, 0, 0.62, 0, 0.55, 0.3, 0, 0.3],
      [0.62, 0, 1, 0, 1, 0.3, 0.55, 0.3],
      [0, 0.3, 1, 0.3, 1, 0.58, 0, 0.66],
      [0, 0.66, 0.45, 0.624, 0.38, 1, 0, 1],
      [0.45, 0.624, 1, 0.58, 1, 1, 0.38, 1],
    ],
  },
];

export const DEFAULT_TEMPLATE_ID = "dynamic-4";

export function getTemplate(id: string): PanelTemplate {
  return PANEL_TEMPLATES.find((t) => t.id === id) ?? PANEL_TEMPLATES[1];
}
