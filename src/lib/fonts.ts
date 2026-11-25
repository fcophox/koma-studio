/**
 * Fuentes self-hosted por next/font: se descargan en build/dev y se sirven
 * desde la propia app, así que en ejecución no se depende de Google.
 *
 * Los proyectos guardan un `FontId` estable (no el nombre que genera
 * next/font) y se resuelve a la familia real al dibujar. `*.style.fontFamily`
 * es el nombre a usar en Konva (canvas), que no lee variables CSS.
 */
import { Bangers, Comic_Neue, Dela_Gothic_One, Inter } from "next/font/google";

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const comicNeue = Comic_Neue({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-comic-neue",
  display: "swap",
});

export const bangers = Bangers({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bangers",
  display: "swap",
});

/** Display con glifos japoneses (ドン, ゴゴゴ…). Se carga bajo demanda. */
export const delaGothic = Dela_Gothic_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dela-gothic",
  display: "swap",
  preload: false,
});

export const fontVariables = `${inter.variable} ${comicNeue.variable} ${bangers.variable} ${delaGothic.variable}`;

export type FontId = "comic-neue" | "bangers" | "dela-gothic" | "inter";

export interface FontOption {
  id: FontId;
  label: string;
  family: string;
  hasBold: boolean;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: "comic-neue", label: "Comic Neue · diálogo", family: comicNeue.style.fontFamily, hasBold: true },
  { id: "bangers", label: "Bangers · grito / SFX", family: bangers.style.fontFamily, hasBold: false },
  { id: "dela-gothic", label: "Dela Gothic · japonés", family: delaGothic.style.fontFamily, hasBold: false },
  { id: "inter", label: "Inter · neutra", family: inter.style.fontFamily, hasBold: true },
];

// Respaldo japonés para cualquier fuente latina (el canvas elige glifo a glifo).
const JP_FALLBACK = `${delaGothic.style.fontFamily}, "Hiragino Sans", "Yu Gothic", sans-serif`;

/** Familia CSS/canvas completa para un FontId guardado en el proyecto. */
export function resolveFont(id: string): string {
  const opt = FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0];
  return opt.id === "dela-gothic" ? `${opt.family}, "Hiragino Sans", sans-serif` : `${opt.family}, ${JP_FALLBACK}`;
}

export const CANVAS_FONTS = {
  ui: inter.style.fontFamily,
  dialogue: comicNeue.style.fontFamily,
  sfx: bangers.style.fontFamily,
};
