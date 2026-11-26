/**
 * Modelo de dominio de Koma Studio.
 *
 * Unidades: todas las coordenadas del lienzo están en "unidades de página"
 * (u). 1u = 1px al exportar a escala 1x. Los formatos impresos usan
 * PX_PER_MM = 4, así que una exportación 3x equivale a ~305 DPI.
 */

export const SCHEMA_VERSION = 1;

export type ReadingDirection = "ltr" | "rtl";

export type PageFormatId = "manga-b5" | "us-comic" | "a4" | "webtoon";

export interface PageFormat {
  id: PageFormatId;
  label: string;
  description: string;
  /** Medidas físicas (null en formatos solo digitales como Webtoon). */
  widthMm: number | null;
  heightMm: number | null;
  /** Medidas en unidades de página (px a 1x). */
  width: number;
  height: number;
}

export interface PageNumbering {
  /** Mostrar el número impreso en el margen inferior. */
  show: boolean;
  /** Número con el que empieza la paginación del capítulo. */
  startAt: number;
  position: "center" | "outer";
  fontSize: number;
  color: string;
}

export interface PanelStyle {
  borderWidth: number;
  borderColor: string;
  /** Separación entre viñetas (u). */
  gutter: number;
  /** Margen exterior de la página (u). */
  margin: number;
  /** Color de fondo de la página (visible en el gutter y márgenes). */
  pageBackground: string;
  /** Relleno de una viñeta vacía. */
  panelFill: string;
}

/** Imagen colocada dentro de una viñeta (recortada por su polígono). */
export interface PlacedImage {
  assetId: string;
  /** Desplazamiento del centro de la imagen respecto al centro de la viñeta (u). */
  offsetX: number;
  offsetY: number;
  /** Escala relativa al tamaño "cover" de la viñeta (1 = cubre exactamente). */
  scale: number;
  /** Grados. */
  rotation: number;
  flipX: boolean;
}

/**
 * Una viñeta: polígono convexo en coordenadas normalizadas (0..1) del área
 * útil de la página. El recorte real con gutter se calcula en geometry.ts.
 */
export interface PanelSlot {
  id: string;
  /** [x0, y0, x1, y1, ...] normalizado 0..1. */
  points: number[];
  image: PlacedImage | null;
}

interface BaseElement {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  locked?: boolean;
}

export type FontStyle = "normal" | "bold" | "italic" | "italic bold";

export type BubbleKind = "oval" | "thought" | "shout" | "whisper" | "narration";

export interface BubbleTail {
  enabled: boolean;
  /** Punta de la cola, relativa al centro del globo (u, sin escalar). */
  tipX: number;
  tipY: number;
}

export interface SpeechBubble extends BaseElement {
  type: "bubble";
  kind: BubbleKind;
  width: number;
  height: number;
  text: string;
  /** FontId (ver lib/fonts.ts). */
  fontFamily: string;
  fontStyle: FontStyle;
  fontSize: number;
  lineHeight: number;
  align: "left" | "center" | "right";
  textColor: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  tail: BubbleTail;
}

export type OnomatopoeiaCategory = "impact" | "speed" | "emotion" | "effects" | "custom";

export interface OnomatopoeiaElement extends BaseElement {
  type: "sfx";
  category: OnomatopoeiaCategory;
  text: string;
  /** FontId (ver lib/fonts.ts). */
  fontFamily: string;
  fontStyle: FontStyle;
  fontSize: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  letterSpacing: number;
  /** Factor de inclinación (tangente), como en Konva. */
  skewX: number;
  /** Apila los caracteres en columna (estilo onomatopeya japonesa). */
  vertical: boolean;
}

/** Elementos libres sobre la página. El orden del array es el z-index. */
export type CanvasElement = SpeechBubble | OnomatopoeiaElement;

export interface Page {
  id: string;
  /** Subcategoría a la que pertenece (sus páginas siempre son consecutivas). */
  sectionId?: string | null;
  templateId: string;
  /** Plantillas a sangre ignoran el margen exterior. */
  bleed: boolean;
  panels: PanelSlot[];
  elements: CanvasElement[];
  style: PanelStyle;
}

export interface Project {
  schemaVersion: number;
  id: string;
  title: string;
  chapterNumber: number;
  chapterTitle: string;
  formatId: PageFormatId;
  readingDirection: ReadingDirection;
  numbering: PageNumbering;
  /** Estilo aplicado a las páginas nuevas. */
  defaultStyle: PanelStyle;
  pages: Page[];
  /** Subcategorías del panel de páginas (agrupan páginas consecutivas). */
  sections: PageSection[];
  /** Subcategorías plegadas en el panel (estado de vista, fuera del deshacer). */
  collapsedSections: string[];
  /** Fichas de personaje del proyecto (biblia de personajes). */
  characters: Character[];
  createdAt: number;
  updatedAt: number;
}

export interface PageSection {
  id: string;
  name: string;
}

export type CharacterImageCategory = "body" | "face" | "outfit" | "variant";

/** Imagen de referencia de un personaje (cuerpo, rostro, ropa o variante). */
export interface CharacterImage {
  id: string;
  assetId: string;
  category: CharacterImageCategory;
  /** Etiqueta libre: "De frente", "Enojado", "Uniforme escolar"… */
  label: string;
}

export interface Character {
  id: string;
  name: string;
  /** Protagonista, antagonista, secundario… (texto libre). */
  role: string;
  description: string;
  /** Color identificativo en listas. */
  color: string;
  /** Imagen usada como avatar; si es null se usa el primer rostro. */
  avatarAssetId: string | null;
  images: CharacterImage[];
  createdAt: number;
}

/** Imagen local persistida en IndexedDB (separada del proyecto). */
export interface Asset {
  id: string;
  projectId: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  blob: Blob;
  createdAt: number;
  /** "character" = referencia de una ficha; no se lista en la biblioteca de imágenes. */
  kind?: "library" | "character";
}

export type AssetMeta = Omit<Asset, "blob">;

export type Selection =
  | { kind: "panel"; pageId: string; panelId: string }
  | { kind: "element"; pageId: string; elementId: string }
  | null;
