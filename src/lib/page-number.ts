import type { PageFormat, PageNumbering, PanelStyle, ReadingDirection } from "./types";

export interface NumberPlacement {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}

/**
 * Posición del número impreso. "Borde exterior" alterna según la página sea
 * recto o verso: en occidental las impares van a la derecha; en manga (RTL)
 * el libro se abre al revés y las impares van a la izquierda.
 */
export function numberPlacement(
  format: PageFormat,
  style: PanelStyle,
  numbering: PageNumbering,
  printedNumber: number,
  direction: ReadingDirection,
): NumberPlacement {
  const bottomSpace = Math.max(style.margin, numbering.fontSize * 1.6);
  const y = format.height - bottomSpace / 2;
  if (numbering.position === "center") return { x: format.width / 2, y, anchor: "middle" };

  const isOdd = printedNumber % 2 !== 0;
  const isRight = direction === "ltr" ? isOdd : !isOdd;
  const inset = Math.max(style.margin, numbering.fontSize);
  return isRight ? { x: format.width - inset, y, anchor: "end" } : { x: inset, y, anchor: "start" };
}
