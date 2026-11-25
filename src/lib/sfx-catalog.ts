import type { FontId } from "./fonts";
import type { FontStyle, OnomatopoeiaCategory } from "./types";

export interface SfxPreset {
  id: string;
  category: Exclude<OnomatopoeiaCategory, "custom">;
  text: string;
  /** Texto de ayuda (traducción / significado). */
  hint?: string;
  fontId: FontId;
  fontStyle?: FontStyle;
  fontSize: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rotation: number;
  skewX: number;
  letterSpacing: number;
  vertical?: boolean;
}

export const SFX_CATEGORIES: Record<SfxPreset["category"], string> = {
  impact: "Acción / Impacto",
  speed: "Velocidad",
  emotion: "Emoción / Ambiente",
  effects: "Efectos / Sonidos",
};

const ink = "#111111";

export const SFX_PRESETS: SfxPreset[] = [
  // ── Impacto
  { id: "boom", category: "impact", text: "BOOM!", fontId: "bangers", fontSize: 110, fill: "#ffd400", stroke: ink, strokeWidth: 10, rotation: -8, skewX: 0, letterSpacing: 2 },
  { id: "pow", category: "impact", text: "POW!", fontId: "bangers", fontSize: 110, fill: "#ff3b30", stroke: ink, strokeWidth: 10, rotation: 6, skewX: 0, letterSpacing: 2 },
  { id: "crash", category: "impact", text: "CRASH!", fontId: "bangers", fontSize: 96, fill: "#ff8a00", stroke: ink, strokeWidth: 9, rotation: -4, skewX: -0.15, letterSpacing: 1 },
  { id: "smash", category: "impact", text: "SMASH!", fontId: "bangers", fontSize: 96, fill: "#ffffff", stroke: "#e11d48", strokeWidth: 10, rotation: 3, skewX: 0.12, letterSpacing: 1 },
  { id: "don", category: "impact", text: "ドン!", hint: "DON — golpe seco", fontId: "dela-gothic", fontSize: 120, fill: ink, stroke: "#ffffff", strokeWidth: 10, rotation: -6, skewX: 0, letterSpacing: 0 },

  // ── Velocidad
  { id: "whoosh", category: "speed", text: "WHOOSH!", fontId: "bangers", fontSize: 88, fill: "#38bdf8", stroke: ink, strokeWidth: 8, rotation: -10, skewX: -0.35, letterSpacing: 3 },
  { id: "swish", category: "speed", text: "SWISH!", fontId: "bangers", fontSize: 80, fill: "#ecfeff", stroke: "#0e7490", strokeWidth: 8, rotation: 8, skewX: -0.3, letterSpacing: 2 },
  { id: "zoom", category: "speed", text: "ZOOM!", fontId: "bangers", fontSize: 96, fill: "#facc15", stroke: ink, strokeWidth: 9, rotation: -4, skewX: -0.4, letterSpacing: 4 },
  { id: "gogogo", category: "speed", text: "ゴゴゴ", hint: "GOGOGO — tensión / amenaza", fontId: "dela-gothic", fontSize: 90, fill: "#6d28d9", stroke: "#ffffff", strokeWidth: 8, rotation: 0, skewX: 0, letterSpacing: 4, vertical: true },

  // ── Emoción / ambiente
  { id: "gasp", category: "emotion", text: "GASP!", fontId: "bangers", fontSize: 80, fill: "#fde68a", stroke: ink, strokeWidth: 8, rotation: -5, skewX: 0, letterSpacing: 2 },
  { id: "sigh", category: "emotion", text: "SIGH...", fontId: "comic-neue", fontStyle: "italic bold", fontSize: 64, fill: "#cbd5e1", stroke: "#334155", strokeWidth: 6, rotation: 4, skewX: 0, letterSpacing: 2 },
  { id: "heartbeat", category: "emotion", text: "BA-DUMP", hint: "Latido", fontId: "bangers", fontSize: 84, fill: "#f43f5e", stroke: "#ffffff", strokeWidth: 8, rotation: -6, skewX: 0, letterSpacing: 3 },
  { id: "dokidoki", category: "emotion", text: "ドキドキ", hint: "DOKIDOKI — corazón acelerado", fontId: "dela-gothic", fontSize: 72, fill: "#ec4899", stroke: "#ffffff", strokeWidth: 7, rotation: -8, skewX: 0, letterSpacing: 2 },

  // ── Efectos / sonidos
  { id: "ring", category: "effects", text: "RING!", fontId: "bangers", fontSize: 84, fill: "#fbbf24", stroke: ink, strokeWidth: 8, rotation: 10, skewX: 0, letterSpacing: 2 },
  { id: "click", category: "effects", text: "CLICK!", fontId: "bangers", fontSize: 64, fill: "#e5e7eb", stroke: ink, strokeWidth: 7, rotation: -3, skewX: 0, letterSpacing: 2 },
  { id: "drip", category: "effects", text: "DRIP...", fontId: "bangers", fontSize: 64, fill: "#60a5fa", stroke: "#0c4a6e", strokeWidth: 6, rotation: 0, skewX: 0, letterSpacing: 3 },
  { id: "bzzt", category: "effects", text: "BZZT!", fontId: "bangers", fontSize: 84, fill: "#a3e635", stroke: ink, strokeWidth: 8, rotation: -7, skewX: 0.2, letterSpacing: 2 },
];

export function getSfxPreset(id: string) {
  return SFX_PRESETS.find((p) => p.id === id) ?? null;
}
