import type { PageFormat, PanelSlot, PanelStyle } from "./types";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function toPoints(flat: number[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
}

export function toFlat(points: Point[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

export function centroid(points: Point[]): Point {
  const n = points.length || 1;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

export function boundingBox(points: Point[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Contrae un polígono convexo `d` unidades hacia dentro desplazando cada arista
 * por su normal interior y cortando aristas consecutivas.
 */
export function insetConvexPolygon(points: Point[], d: number): Point[] {
  if (d === 0 || points.length < 3) return points;
  const c = centroid(points);
  const n = points.length;

  // Cada arista desplazada: punto + dirección.
  const lines = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    if (nx * (c.x - mx) + ny * (c.y - my) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { px: p.x + nx * d, py: p.y + ny * d, dx, dy };
  });

  return points.map((orig, i) => {
    const a = lines[(i - 1 + n) % n];
    const b = lines[i];
    const cross = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(cross) < 1e-9) {
      // Aristas colineales: proyectar el vértice original sobre la línea b.
      return { x: b.px + (orig.x - points[i].x), y: b.py + (orig.y - points[i].y) };
    }
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / cross;
    return { x: a.px + a.dx * t, y: a.py + a.dy * t };
  });
}

/** Área útil donde se reparten las viñetas (antes de aplicar el gutter). */
export function liveArea(format: PageFormat, style: PanelStyle, bleed: boolean): Rect {
  // Se expande gutter/2 para que, tras contraer cada viñeta gutter/2, los
  // bordes exteriores queden exactamente en el margen.
  const half = style.gutter / 2;
  const m = bleed ? -half : style.margin - half;
  return {
    x: m,
    y: m,
    width: format.width - m * 2,
    height: format.height - m * 2,
  };
}

/** Polígono absoluto (u) de una viñeta, ya con gutter aplicado. */
export function panelPolygon(
  panel: PanelSlot,
  format: PageFormat,
  style: PanelStyle,
  bleed: boolean,
): Point[] {
  const area = liveArea(format, style, bleed);
  const abs = toPoints(panel.points).map((p) => ({
    x: area.x + p.x * area.width,
    y: area.y + p.y * area.height,
  }));
  const inset = insetConvexPolygon(abs, style.gutter / 2);
  if (!bleed) return inset;
  // A sangre: los vértices que tocan el borde se llevan fuera de la página
  // para que no aparezca una línea blanca al recortar.
  return inset.map((p) => ({
    x: p.x <= 0.5 ? -2 : p.x >= format.width - 0.5 ? format.width + 2 : p.x,
    y: p.y <= 0.5 ? -2 : p.y >= format.height - 0.5 ? format.height + 2 : p.y,
  }));
}

/** Espeja horizontalmente puntos normalizados (para lectura manga RTL). */
export function mirrorNormalized(flat: number[]): number[] {
  return flat.map((v, i) => (i % 2 === 0 ? 1 - v : v));
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Ray casting: ¿está el punto dentro del polígono? */
export function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface ImageLayout {
  /** Centro de la imagen en coordenadas de página. */
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
  flipX: boolean;
  /** Escala "cover" base (u por px de la imagen original). */
  coverScale: number;
}

/**
 * Traduce una PlacedImage a medidas reales dentro de su viñeta.
 * scale = 1 → la imagen cubre exactamente el bounding box de la viñeta.
 */
export function imageLayout(
  image: { offsetX: number; offsetY: number; scale: number; rotation: number; flipX: boolean },
  naturalWidth: number,
  naturalHeight: number,
  poly: Point[],
): ImageLayout {
  const box = boundingBox(poly);
  const coverScale = Math.max(box.width / naturalWidth, box.height / naturalHeight);
  const s = coverScale * image.scale;
  return {
    cx: box.x + box.width / 2 + image.offsetX,
    cy: box.y + box.height / 2 + image.offsetY,
    width: naturalWidth * s,
    height: naturalHeight * s,
    rotation: image.rotation,
    flipX: image.flipX,
    coverScale,
  };
}

/** Valor de `scale` con el que la imagen cabe entera en la viñeta (contain). */
export function containScale(naturalWidth: number, naturalHeight: number, poly: Point[]): number {
  const box = boundingBox(poly);
  const cover = Math.max(box.width / naturalWidth, box.height / naturalHeight);
  const contain = Math.min(box.width / naturalWidth, box.height / naturalHeight);
  return contain / cover;
}
