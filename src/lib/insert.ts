"use client";

import { viewportCenter } from "./canvas-bridge";
import { clamp } from "./geometry";
import type { PageFormat } from "./types";

/** Dónde insertar un elemento nuevo: centro visible, dentro de la página. */
export function insertionPoint(format: PageFormat, jitterSeed = 0) {
  const c = viewportCenter() ?? { x: format.width / 2, y: format.height / 2 };
  // Pequeño desplazamiento para que inserciones seguidas no se apilen exactas.
  const j = ((jitterSeed % 5) - 2) * 18;
  return {
    x: clamp(c.x + j, format.width * 0.12, format.width * 0.88),
    y: clamp(c.y + j, format.height * 0.1, format.height * 0.9),
  };
}
