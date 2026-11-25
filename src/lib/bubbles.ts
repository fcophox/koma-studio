/**
 * Geometría de globos de diálogo, compartida por Konva (Path2D) y las
 * miniaturas SVG.
 *
 * Coordenadas locales: centro del globo en (0,0), sin escala ni rotación.
 * Cada globo se describe como varias subrutas (cuerpo, cola, burbujas…). Para
 * que el contorno se vea "fundido" se dibuja primero el trazo de todas con el
 * doble de grosor y después el relleno de todas encima: el relleno tapa las
 * líneas interiores y queda visible solo el borde exterior.
 */
import type { BubbleKind, SpeechBubble } from "./types";

export interface BubbleGeometry {
  paths: string[];
  dash: number[] | null;
  lineJoin: "round" | "miter";
}

type Pt = { x: number; y: number };

const f = (n: number) => Math.round(n * 100) / 100;

function ellipseD(cx: number, cy: number, rx: number, ry: number) {
  return `M${f(cx + rx)},${f(cy)} A${f(rx)},${f(ry)} 0 1 1 ${f(cx - rx)},${f(cy)} A${f(rx)},${f(ry)} 0 1 1 ${f(cx + rx)},${f(cy)} Z`;
}

function polygonD(pts: Pt[]) {
  return `M${pts.map((p) => `${f(p.x)},${f(p.y)}`).join(" L")} Z`;
}

/** PRNG determinista (mulberry32) para que los picos no cambien entre renders. */
function seeded(seedText: string) {
  let h = 1779033703;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cola curva desde el borde de una elipse hasta la punta. */
function ellipseTailD(rx: number, ry: number, tip: Pt, inset = 0.86) {
  const theta = Math.atan2(tip.y / ry, tip.x / rx);
  const spread = 0.2;
  const b1 = { x: rx * inset * Math.cos(theta - spread), y: ry * inset * Math.sin(theta - spread) };
  const b2 = { x: rx * inset * Math.cos(theta + spread), y: ry * inset * Math.sin(theta + spread) };
  const dx = (b2.x - b1.x) * 0.18;
  const dy = (b2.y - b1.y) * 0.18;
  const c1 = { x: (b1.x + tip.x) / 2 + dx, y: (b1.y + tip.y) / 2 + dy };
  const c2 = { x: (b2.x + tip.x) / 2 - dx, y: (b2.y + tip.y) / 2 - dy };
  return `M${f(b1.x)},${f(b1.y)} Q${f(c1.x)},${f(c1.y)} ${f(tip.x)},${f(tip.y)} Q${f(c2.x)},${f(c2.y)} ${f(b2.x)},${f(b2.y)} Z`;
}

function isTipOutside(rx: number, ry: number, tip: Pt) {
  return (tip.x / rx) ** 2 + (tip.y / ry) ** 2 > 1.05;
}

export function bubbleGeometry(b: Pick<SpeechBubble, "id" | "kind" | "width" | "height" | "tail" | "strokeWidth">): BubbleGeometry {
  const rx = b.width / 2;
  const ry = b.height / 2;
  const tip = { x: b.tail.tipX, y: b.tail.tipY };
  const hasTail = b.tail.enabled && isTipOutside(rx, ry, tip);
  const paths: string[] = [];

  switch (b.kind) {
    case "oval":
    case "whisper": {
      paths.push(ellipseD(0, 0, rx, ry));
      if (hasTail) paths.push(ellipseTailD(rx, ry, tip));
      const dash = b.kind === "whisper" ? [Math.max(4, b.strokeWidth * 3.5), Math.max(3, b.strokeWidth * 2.5)] : null;
      return { paths, dash, lineJoin: "round" };
    }

    case "thought": {
      const k = 0.8;
      const irx = rx * k;
      const iry = ry * k;
      const perimeter = Math.PI * (3 * (irx + iry) - Math.sqrt((3 * irx + iry) * (irx + 3 * iry)));
      const count = Math.max(8, Math.round(perimeter / (Math.min(rx, ry) * 0.55)));
      const r = (perimeter / count) * 0.72;
      const rand = seeded(b.id);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const rr = r * (0.9 + rand() * 0.25);
        paths.push(ellipseD(irx * Math.cos(a), iry * Math.sin(a), rr, rr));
      }
      paths.push(ellipseD(0, 0, irx, iry));
      if (hasTail) {
        // Burbujas decrecientes hacia la punta (el "pensamiento" no tiene cola sólida).
        const theta = Math.atan2(tip.y / ry, tip.x / rx);
        const edge = { x: rx * Math.cos(theta), y: ry * Math.sin(theta) };
        const base = Math.min(rx, ry);
        [
          [0.3, 0.17],
          [0.62, 0.11],
          [0.9, 0.065],
        ].forEach(([t, s]) => {
          paths.push(ellipseD(edge.x + (tip.x - edge.x) * t, edge.y + (tip.y - edge.y) * t, base * s, base * s));
        });
      }
      return { paths, dash: null, lineJoin: "round" };
    }

    case "shout": {
      const rand = seeded(b.id);
      const spikes = Math.max(10, Math.round((b.width + b.height) / 32));
      const pts: Pt[] = [];
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2 + 0.1;
        const isOuter = i % 2 === 0;
        const factor = isOuter ? 1 + 0.06 * rand() : 0.74 + 0.08 * rand();
        pts.push({ x: rx * factor * Math.cos(a), y: ry * factor * Math.sin(a) });
      }
      paths.push(polygonD(pts));
      if (hasTail) {
        const theta = Math.atan2(tip.y / ry, tip.x / rx);
        const b1 = { x: rx * 0.6 * Math.cos(theta - 0.22), y: ry * 0.6 * Math.sin(theta - 0.22) };
        const b2 = { x: rx * 0.6 * Math.cos(theta + 0.22), y: ry * 0.6 * Math.sin(theta + 0.22) };
        // Cola en zigzag, típica del grito.
        const mid = { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2 };
        const kink = {
          x: mid.x + (tip.x - mid.x) * 0.55 + (b2.x - b1.x) * 0.5,
          y: mid.y + (tip.y - mid.y) * 0.55 + (b2.y - b1.y) * 0.5,
        };
        paths.push(polygonD([b1, kink, tip, b2]));
      }
      return { paths, dash: null, lineJoin: "miter" };
    }

    case "narration": {
      paths.push(polygonD([
        { x: -rx, y: -ry },
        { x: rx, y: -ry },
        { x: rx, y: ry },
        { x: -rx, y: ry },
      ]));
      if (b.tail.enabled && (Math.abs(tip.x) > rx || Math.abs(tip.y) > ry)) {
        // Punto del borde en dirección a la punta.
        const scale = Math.min(rx / Math.abs(tip.x || 1e-6), ry / Math.abs(tip.y || 1e-6));
        const edge = { x: tip.x * scale, y: tip.y * scale };
        const isHorizontalEdge = Math.abs(Math.abs(edge.y) - ry) < 0.5;
        const w = (isHorizontalEdge ? rx : ry) * 0.18;
        const inward = isHorizontalEdge ? { x: 0, y: -Math.sign(edge.y) * 4 } : { x: -Math.sign(edge.x) * 4, y: 0 };
        const b1 = isHorizontalEdge ? { x: edge.x - w, y: edge.y } : { x: edge.x, y: edge.y - w };
        const b2 = isHorizontalEdge ? { x: edge.x + w, y: edge.y } : { x: edge.x, y: edge.y + w };
        paths.push(polygonD([
          { x: b1.x + inward.x, y: b1.y + inward.y },
          tip,
          { x: b2.x + inward.x, y: b2.y + inward.y },
        ]));
      }
      return { paths, dash: null, lineJoin: "miter" };
    }
  }
}

/** Caja interior donde va el texto (ancho, alto) para cada tipo de globo. */
export function bubbleTextBox(kind: BubbleKind, width: number, height: number) {
  switch (kind) {
    case "narration": {
      const pad = Math.min(18, width * 0.07);
      return { width: width - pad * 2, height: height - pad * 2 };
    }
    case "shout":
      return { width: width * 0.6, height: height * 0.56 };
    case "thought":
      return { width: width * 0.66, height: height * 0.62 };
    default:
      return { width: width * 0.74, height: height * 0.7 };
  }
}

/** Posiciones rápidas de cola (relativas al centro). */
export function tailPreset(side: "left" | "right" | "bottom", width: number, height: number) {
  if (side === "left") return { tipX: -width * 0.42, tipY: height * 0.95 };
  if (side === "right") return { tipX: width * 0.42, tipY: height * 0.95 };
  return { tipX: 0, tipY: height * 1.05 };
}
