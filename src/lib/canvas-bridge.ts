/**
 * Puente mínimo entre el lienzo y los paneles laterales: permite insertar
 * elementos en el centro de lo que el usuario está viendo sin subir el
 * viewport (que cambia en cada frame de zoom/pan) al store global.
 */
import type { Point } from "./geometry";

let getCenter: (() => Point | null) | null = null;

export function registerViewportCenter(fn: (() => Point | null) | null) {
  getCenter = fn;
}

/** Centro visible en coordenadas de página, o null si el lienzo no está montado. */
export function viewportCenter(): Point | null {
  return getCenter?.() ?? null;
}

/** Tipo MIME del drag & drop de catálogo (globo / onomatopeya → lienzo). */
export const ELEMENT_DRAG_MIME = "application/x-koma-element";

export type ElementDragPayload =
  | { kind: "bubble"; bubbleKind: import("./types").BubbleKind }
  | { kind: "sfx"; presetId: string }
  | { kind: "sfx-custom"; text: string };
