"use client";

/**
 * Empaquetado y descarga de exportaciones: PNG/JPG sueltos, ZIP por lote
 * (JSZip) y PDF multipágina (jsPDF). Las librerías pesadas se cargan bajo
 * demanda, solo cuando el usuario exporta.
 */
import { getFormat } from "./formats";
import type { Page, Project } from "./types";
import { formatPageNumber, safeFileName } from "./utils";

export type ExportFormat = "png" | "jpg" | "pdf";
export type ExportScope = "page" | "chapter";

export interface ExportSettings {
  scope: ExportScope;
  format: ExportFormat;
  scale: 1 | 2 | 3;
  /** Calidad JPEG (también para las imágenes dentro del PDF). */
  quality: number;
}

export interface ExportProgress {
  done: number;
  total: number;
  phase: "preparing" | "rendering" | "packing";
}

export class ExportCancelled extends Error {
  constructor() {
    super("Exportación cancelada");
  }
}

/** "20261125-1432" */
export function timestamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** "[NombreProyecto]_Cap[Numero]" */
export function exportBaseName(project: Project) {
  return `${safeFileName(project.title)}_Cap${formatPageNumber(project.chapterNumber)}`;
}

/** "001_pagina.png" — orden secuencial del capítulo. */
export function pageFileName(index: number, ext: string) {
  return `${String(index + 1).padStart(3, "0")}_pagina.${ext}`;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo codificar la imagen"))), mime, quality),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Dar tiempo al navegador a iniciar la descarga antes de liberar la URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

/**
 * Ejecuta la exportación completa y descarga el resultado.
 * Devuelve el nombre del archivo generado.
 */
export async function runExport(
  project: Project,
  activePageId: string,
  settings: ExportSettings,
  onProgress: (p: ExportProgress) => void,
  isCancelled: () => boolean,
): Promise<string> {
  const { preparePages, renderPageCanvas } = await import("@/components/editor/export/render-page");
  const format = getFormat(project.formatId);

  const targets: Array<{ page: Page; index: number }> =
    settings.scope === "page"
      ? project.pages.flatMap((page, index) => (page.id === activePageId ? [{ page, index }] : []))
      : project.pages.map((page, index) => ({ page, index }));
  if (targets.length === 0) throw new Error("No hay páginas para exportar");

  const total = targets.length;
  onProgress({ done: 0, total, phase: "preparing" });
  await preparePages(targets.map((t) => t.page));

  const check = () => {
    if (isCancelled()) throw new ExportCancelled();
  };

  const base = exportBaseName(project);
  const stamp = timestamp();
  const isJpg = settings.format === "jpg";
  const mime = isJpg ? "image/jpeg" : "image/png";
  const ext = isJpg ? "jpg" : "png";

  // ── PDF multipágina ─────────────────────────────────────────
  if (settings.format === "pdf") {
    const { jsPDF } = await import("jspdf");
    // Tamaño físico real en formatos impresos; en Webtoon, px a 96 DPI.
    const isPhysical = format.widthMm !== null && format.heightMm !== null;
    const unit = isPhysical ? "mm" : "pt";
    const w = isPhysical ? format.widthMm! : format.width * 0.75;
    const h = isPhysical ? format.heightMm! : format.height * 0.75;
    const doc = new jsPDF({ unit, format: [w, h], orientation: w > h ? "landscape" : "portrait", compress: true });
    doc.setProperties({
      title: `${project.title} — Capítulo ${project.chapterNumber}${project.chapterTitle ? `: ${project.chapterTitle}` : ""}`,
      creator: "Koma Studio",
    });
    // Manga: los lectores PDF que lo soportan pasan páginas de derecha a izquierda.
    if (project.readingDirection === "rtl") doc.viewerPreferences({ Direction: "R2L" });

    for (let i = 0; i < targets.length; i++) {
      check();
      onProgress({ done: i, total, phase: "rendering" });
      await yieldToUI();
      const canvas = await renderPageCanvas({ project, ...targets[i], pixelRatio: settings.scale });
      if (i > 0) doc.addPage([w, h], w > h ? "landscape" : "portrait");
      doc.addImage(canvas.toDataURL("image/jpeg", settings.quality), "JPEG", 0, 0, w, h, undefined, "FAST");
      canvas.width = canvas.height = 0; // liberar memoria del lienzo grande
    }
    check();
    onProgress({ done: total, total, phase: "packing" });
    const name =
      settings.scope === "page"
        ? `${base}_p${formatPageNumber(targets[0].index + 1, 3)}.pdf`
        : `${base}_${stamp}.pdf`;
    downloadBlob(doc.output("blob"), name);
    return name;
  }

  // ── Página suelta PNG/JPG ───────────────────────────────────
  if (settings.scope === "page") {
    onProgress({ done: 0, total, phase: "rendering" });
    const { page, index } = targets[0];
    const canvas = await renderPageCanvas({ project, page, index, pixelRatio: settings.scale });
    check();
    const blob = await canvasToBlob(canvas, mime, isJpg ? settings.quality : undefined);
    const name = `${base}_${pageFileName(index, ext)}`;
    onProgress({ done: 1, total, phase: "packing" });
    downloadBlob(blob, name);
    return name;
  }

  // ── Capítulo en ZIP ─────────────────────────────────────────
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (let i = 0; i < targets.length; i++) {
    check();
    onProgress({ done: i, total, phase: "rendering" });
    await yieldToUI();
    const canvas = await renderPageCanvas({ project, ...targets[i], pixelRatio: settings.scale });
    const blob = await canvasToBlob(canvas, mime, isJpg ? settings.quality : undefined);
    canvas.width = canvas.height = 0;
    zip.file(pageFileName(targets[i].index, ext), blob);
  }
  check();
  onProgress({ done: total, total, phase: "packing" });
  // PNG/JPG ya van comprimidos: STORE evita recomprimir y es mucho más rápido.
  const zipBlob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const name = `${base}_${stamp}.zip`;
  downloadBlob(zipBlob, name);
  return name;
}
