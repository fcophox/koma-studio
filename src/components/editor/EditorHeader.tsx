"use client";

import { useState } from "react";
import { AlertTriangle, Check, Download, FolderSync, Loader2, Redo2, Settings2, Undo2 } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button, IconButton } from "@/components/ui/Button";
import { getFormat } from "@/lib/formats";
import { selectCanRedo, selectCanUndo, useEditorStore, type SaveStatus } from "@/lib/store/editor-store";
import { formatChapter } from "@/lib/utils";
import { ExportDialog } from "./ExportDialog";
import { PackageDialog } from "./PackageDialog";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "",
  dirty: "Cambios sin guardar",
  saving: "Guardando…",
  saved: "Guardado",
  error: "Error al guardar",
};

function SaveIndicator({ status }: { status: SaveStatus }) {
  const icon =
    status === "saving" || status === "dirty" ? (
      <Loader2 className="size-3 animate-spin" />
    ) : status === "error" ? (
      <AlertTriangle className="size-3 text-red-400" />
    ) : status === "saved" ? (
      <Check className="size-3 text-emerald-400" />
    ) : null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-500" aria-live="polite">
      {icon}
      {SAVE_LABEL[status]}
    </span>
  );
}

export function EditorHeader() {
  const project = useEditorStore((s) => s.project);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPackageOpen, setIsPackageOpen] = useState(false);

  if (!project) return null;
  const format = getFormat(project.formatId);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface-1 px-3">
      <Logo isCompact />
      <div className="h-5 w-px bg-line" />

      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        className="group flex min-w-0 items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-surface-3"
        title="Editar metadata del proyecto"
      >
        <span className="truncate text-sm font-semibold tracking-tight">{project.title}</span>
        <span className="hidden truncate text-xs text-zinc-400 md:inline">
          {formatChapter(project.chapterNumber, project.chapterTitle)}
        </span>
      </button>

      <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-zinc-500 lg:flex">
        <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-zinc-300">{format.label}</span>
        <span className="rounded-md bg-surface-3 px-1.5 py-0.5">
          {project.readingDirection === "rtl" ? "Manga ←" : "Occidental →"}
        </span>
      </span>

      <div className="ml-auto flex items-center gap-1">
        <SaveIndicator status={saveStatus} />
        <div className="mx-2 h-5 w-px bg-line" />
        <IconButton label="Deshacer (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 className="size-4" />
        </IconButton>
        <IconButton label="Rehacer (Ctrl+Y)" onClick={redo} disabled={!canRedo}>
          <Redo2 className="size-4" />
        </IconButton>
        <IconButton label="Ajustes del proyecto" onClick={() => setIsSettingsOpen(true)}>
          <Settings2 className="size-4" />
        </IconButton>
        <Button
          size="sm"
          className="ml-2"
          icon={<FolderSync className="size-3.5" />}
          onClick={() => setIsPackageOpen(true)}
          title="Guardar el proyecto en una carpeta ordenada de tu disco"
        >
          Empaquetar
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<Download className="size-3.5" />}
          onClick={() => setIsExportOpen(true)}
        >
          Exportar
        </Button>
      </div>

      <ProjectSettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ExportDialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <PackageDialog isOpen={isPackageOpen} onClose={() => setIsPackageOpen(false)} />
    </header>
  );
}
