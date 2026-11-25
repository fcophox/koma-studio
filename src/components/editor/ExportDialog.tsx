"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileArchive, FileImage, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented, SliderRow } from "@/components/ui/Fields";
import { Modal } from "@/components/ui/Modal";
import {
  ExportCancelled,
  exportBaseName,
  pageFileName,
  runExport,
  type ExportFormat,
  type ExportProgress,
  type ExportScope,
} from "@/lib/export";
import { getFormat } from "@/lib/formats";
import { selectActivePageIndex, useEditorStore } from "@/lib/store/editor-store";
import { formatPageNumber } from "@/lib/utils";

type Scale = "1" | "2" | "3";
type Status = { kind: "idle" } | { kind: "running" } | { kind: "done"; fileName: string } | { kind: "error"; message: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const PHASE_LABEL: Record<ExportProgress["phase"], string> = {
  preparing: "Cargando imágenes y fuentes…",
  rendering: "Renderizando",
  packing: "Empaquetando…",
};

export function ExportDialog({ isOpen, onClose }: Props) {
  const project = useEditorStore((s) => s.project);
  const activePageId = useEditorStore((s) => s.activePageId);
  const pageIndex = useEditorStore(selectActivePageIndex);
  const [scope, setScope] = useState<ExportScope>("chapter");
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState<Scale>("2");
  const [quality, setQuality] = useState(92);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const cancelRef = useRef(false);

  if (!project || !activePageId) return null;

  const fmt = getFormat(project.formatId);
  const s = Number(scale) as 1 | 2 | 3;
  const px = `${fmt.width * s} × ${fmt.height * s} px`;
  const dpi = fmt.widthMm ? Math.round((fmt.width * s) / (fmt.widthMm / 25.4)) : null;
  const pageCount = scope === "chapter" ? project.pages.length : 1;
  const isRunning = status.kind === "running";
  const usesQuality = format === "jpg" || format === "pdf";

  const base = exportBaseName(project);
  const outputName =
    format === "pdf"
      ? scope === "chapter"
        ? `${base}_[fecha].pdf`
        : `${base}_p${formatPageNumber(pageIndex + 1, 3)}.pdf`
      : scope === "chapter"
        ? `${base}_[fecha].zip  →  ${pageFileName(0, format)}, ${pageFileName(1, format)}…`
        : `${base}_${pageFileName(pageIndex, format)}`;

  const handleExport = async () => {
    cancelRef.current = false;
    setStatus({ kind: "running" });
    setProgress(null);
    try {
      // Snapshot del proyecto: seguir editando no altera lo que se exporta.
      const fileName = await runExport(
        project,
        activePageId,
        { scope, format, scale: s, quality: quality / 100 },
        setProgress,
        () => cancelRef.current,
      );
      setStatus({ kind: "done", fileName });
    } catch (err) {
      if (err instanceof ExportCancelled) setStatus({ kind: "idle" });
      else {
        console.error(err);
        setStatus({ kind: "error", message: err instanceof Error ? err.message : "Error desconocido" });
      }
    } finally {
      setProgress(null);
    }
  };

  const handleClose = () => {
    if (isRunning) cancelRef.current = true;
    setStatus({ kind: "idle" });
    onClose();
  };

  const percent = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  const ScopeIcon = format === "pdf" ? FileText : scope === "chapter" ? FileArchive : FileImage;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Exportar"
      description="Render limpio, sin selección ni guías. Todo se genera en tu navegador."
      footer={
        isRunning ? (
          <Button variant="ghost" onClick={() => (cancelRef.current = true)}>
            Cancelar
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cerrar
            </Button>
            <Button variant="primary" icon={<Download className="size-4" />} onClick={handleExport}>
              Exportar {pageCount > 1 ? `${pageCount} páginas` : "página"}
            </Button>
          </>
        )
      }
    >
      <fieldset disabled={isRunning} className="flex flex-col gap-5 disabled:opacity-60">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Alcance</span>
          <Segmented<ExportScope>
            value={scope}
            onChange={setScope}
            options={[
              { value: "page", label: `Página actual (${formatPageNumber(project.numbering.startAt + pageIndex)})` },
              { value: "chapter", label: `Capítulo completo (${project.pages.length})` },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Formato</span>
          <Segmented<ExportFormat>
            value={format}
            onChange={setFormat}
            options={[
              { value: "png", label: "PNG", title: "Sin pérdida, máxima calidad" },
              { value: "jpg", label: "JPG", title: "Más ligero, compresión ajustable" },
              { value: "pdf", label: "PDF", title: "Un documento multipágina" },
            ]}
          />
        </div>

        {usesQuality && (
          <SliderRow
            label={format === "pdf" ? "Calidad de las páginas (JPEG)" : "Calidad JPG"}
            value={quality}
            min={50}
            max={100}
            unit="%"
            onChange={setQuality}
          />
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Resolución</span>
          <Segmented<Scale>
            value={scale}
            onChange={setScale}
            options={[
              { value: "1", label: "1× vista previa" },
              { value: "2", label: "2× web" },
              { value: "3", label: "3× impresión" },
            ]}
          />
          <p className="text-xs text-zinc-500 tabular-nums">
            Cada página: {px}
            {dpi ? ` · ≈ ${dpi} DPI a ${fmt.widthMm}×${fmt.heightMm} mm` : ""}
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
          <ScopeIcon className="mt-0.5 size-4 shrink-0 text-zinc-400" />
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500">Se descargará</p>
            <p className="font-mono text-[11px] break-all text-zinc-300">{outputName}</p>
            {format === "pdf" && project.readingDirection === "rtl" && (
              <p className="mt-1 text-[11px] text-zinc-500">PDF marcado para lectura de derecha a izquierda.</p>
            )}
          </div>
        </div>
      </fieldset>

      {isRunning && (
        <div className="mt-5 flex flex-col gap-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <span className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin text-accent" />
              {progress ? PHASE_LABEL[progress.phase] : "Iniciando…"}
              {progress?.phase === "rendering" && ` página ${progress.done + 1} de ${progress.total}`}
            </span>
            <span className="tabular-nums text-zinc-500">{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {status.kind === "done" && (
        <p className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="min-w-0 break-all">Listo: {status.fileName}</span>
        </p>
      )}
      {status.kind === "error" && (
        <p className="mt-5 flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
          <AlertTriangle className="size-4 shrink-0" />
          No se pudo exportar: {status.message}
        </p>
      )}
    </Modal>
  );
}
