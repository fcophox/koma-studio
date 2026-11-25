"use client";

/**
 * Render limpio de páginas para exportar.
 *
 * Monta el mismo <PageRenderer> del editor en modo "export" (sin sombra,
 * selección, asas, números de viñeta ni modo encuadre) en un Stage de Konva
 * fuera de pantalla, del tamaño exacto de la página, y lo rasteriza con
 * `pixelRatio` = escala de exportación (1x/2x/3x).
 *
 * Este módulo importa Konva: cárgalo con import() dinámico desde el cliente.
 */
import { createRoot } from "react-dom/client";
import { Layer, Stage } from "react-konva";
import type Konva from "konva";
import { CANVAS_FONTS, resolveFont } from "@/lib/fonts";
import { getFormat } from "@/lib/formats";
import { ensureAssetImage } from "@/lib/image-cache";
import type { Page, Project } from "@/lib/types";
import { PageRenderer } from "../canvas/PageRenderer";

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Deja listas imágenes y fuentes antes de rasterizar: el canvas no espera a
 * nada y dibujaría huecos o una fuente de respaldo.
 */
export async function preparePages(pages: Page[]) {
  const assetIds = new Set(pages.flatMap((p) => p.panels.flatMap((pn) => (pn.image ? [pn.image.assetId] : []))));
  await Promise.all([...assetIds].map((id) => ensureAssetImage(id)));

  const fontLoads: Promise<unknown>[] = [document.fonts.load(`32px ${CANVAS_FONTS.ui}`, "0123456789")];
  pages.forEach((p) =>
    p.elements.forEach((el) => {
      // Pasar el texto real hace que se descarguen los tramos unicode necesarios (kana/kanji).
      fontLoads.push(document.fonts.load(`${el.fontStyle} 32px ${resolveFont(el.fontFamily)}`, el.text || "A"));
    }),
  );
  await Promise.allSettled(fontLoads);
  await document.fonts.ready;
}

interface RenderOptions {
  project: Project;
  page: Page;
  /** Posición de la página en el capítulo (para el número impreso). */
  index: number;
  pixelRatio: number;
}

export async function renderPageCanvas({ project, page, index, pixelRatio }: RenderOptions): Promise<HTMLCanvasElement> {
  const format = getFormat(project.formatId);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;opacity:0;";
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    const stage = await new Promise<Konva.Stage>((resolve) => {
      root.render(
        <Stage
          width={format.width}
          height={format.height}
          ref={(s) => {
            if (s) resolve(s);
          }}
        >
          <Layer listening={false}>
            <PageRenderer
              page={page}
              format={format}
              numbering={project.numbering}
              direction={project.readingDirection}
              printedNumber={project.numbering.startAt + index}
              mode="export"
            />
          </Layer>
        </Stage>,
      );
    });

    // react-konva confirma los hijos en su propio reconciliador: esperar a que
    // el árbol esté completo antes de dibujar.
    await nextFrame();
    await nextFrame();
    stage.draw();
    return stage.toCanvas({ x: 0, y: 0, width: format.width, height: format.height, pixelRatio });
  } finally {
    root.unmount();
    host.remove();
  }
}
