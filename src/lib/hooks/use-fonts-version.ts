"use client";

import { useEffect, useState } from "react";
import { FONT_OPTIONS } from "../fonts";

/**
 * El canvas no se redibuja solo cuando termina de cargar una fuente web.
 * Este contador sube cada vez que el navegador carga fuentes, para remontar
 * la capa de Konva y que el texto se mida y dibuje con la fuente real.
 */
export function useFontsVersion() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let isAlive = true;
    const bump = () => isAlive && setVersion((v) => v + 1);
    const loads = FONT_OPTIONS.flatMap((f) =>
      ["normal", "bold", "italic bold"].map((style) => document.fonts.load(`${style} 32px ${f.family}`, "Aaドン")),
    );
    Promise.allSettled(loads).then(bump);
    document.fonts.addEventListener("loadingdone", bump);
    return () => {
      isAlive = false;
      document.fonts.removeEventListener("loadingdone", bump);
    };
  }, []);

  return version;
}
