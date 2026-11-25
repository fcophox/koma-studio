"use client";

import Konva from "konva";

interface MeasureOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontStyle?: string;
  lineHeight?: number;
  letterSpacing?: number;
  /** Ancho fijo con ajuste de línea por palabras; sin él, una línea por "\n". */
  width?: number;
}

let probe: Konva.Text | null = null;

/** Mide un texto con el mismo motor que lo dibuja (Konva), sin montarlo. */
export function measureText(o: MeasureOptions): { width: number; height: number } {
  probe ??= new Konva.Text();
  probe.setAttrs({
    text: o.text || " ",
    fontFamily: o.fontFamily,
    fontSize: o.fontSize,
    fontStyle: o.fontStyle ?? "normal",
    lineHeight: o.lineHeight ?? 1,
    letterSpacing: o.letterSpacing ?? 0,
    // Konva acepta "auto" en tiempo de ejecución aunque sus tipos digan number.
    width: (o.width ?? "auto") as number,
    wrap: o.width ? "word" : "none",
    padding: 0,
  });
  return { width: probe.width(), height: probe.height() };
}

/** Texto apilado en columna para onomatopeyas verticales (respeta emojis/kana). */
export function verticalize(text: string) {
  return Array.from(text.replace(/\n/g, "")).join("\n");
}
