"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderInput, FolderOpen, FolderSync, Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CHARACTER_COLORS } from "@/lib/characters";
import { createCharacter, newId } from "@/lib/factory";
import {
  ensureWritePermission,
  getLinkedFolder,
  isFolderAccessSupported,
  linkFolder,
  pickProjectFolder,
  unlinkFolder,
} from "@/lib/package/folder-link";
import {
  CATEGORY_FOLDERS,
  characterFolder,
  recordImported,
  scanNewFiles,
  writePackage,
  type PackageProgress,
} from "@/lib/package/package";
import { useAssetStore } from "@/lib/store/asset-store";
import { useEditorStore } from "@/lib/store/editor-store";
import { safeFileName } from "@/lib/utils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type Status =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

const PHASE: Record<PackageProgress["phase"], string> = {
  images: "Copiando imágenes",
  pages: "Renderizando páginas",
  manifest: "Guardando datos del proyecto",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function PackageDialog({ isOpen, onClose }: Props) {
  const project = useEditorStore((s) => s.project);
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [includePages, setIncludePages] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [progress, setProgress] = useState<PackageProgress | null>(null);
  const isSupported = isFolderAccessSupported();
  const projectId = project?.id;

  // Recuperar la carpeta vinculada (IndexedDB es un sistema externo).
  useEffect(() => {
    if (!isOpen || !projectId) return;
    let isAlive = true;
    getLinkedFolder(projectId).then((h) => isAlive && setFolder(h));
    return () => {
      isAlive = false;
    };
  }, [isOpen, projectId]);

  if (!project) return null;
  const isBusy = status.kind === "busy";

  const runWrite = async (root: FileSystemDirectoryHandle) => {
    setStatus({ kind: "busy", label: "Empaquetando…" });
    try {
      // Estado más reciente (puede haber cambiado desde que se abrió el diálogo).
      const latest = useEditorStore.getState().project!;
      const result = await writePackage(
        root,
        latest,
        useAssetStore.getState().assets,
        { includePages, pageScale: 2 },
        setProgress,
      );
      const parts = [
        result.written ? plural(result.written, "imagen copiada", "imágenes copiadas") : "imágenes al día",
        result.pages ? plural(result.pages, "página renderizada", "páginas renderizadas") : null,
      ].filter(Boolean);
      setStatus({ kind: "done", message: `Paquete actualizado en "${root.name}": ${parts.join(", ")}.` });
    } catch (err) {
      console.error(err);
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "No se pudo escribir en la carpeta" });
    } finally {
      setProgress(null);
    }
  };

  const handleChooseFolder = async () => {
    const root = await pickProjectFolder(safeFileName(project.title));
    if (!root) return;
    await linkFolder(project.id, root);
    setFolder(root);
    await runWrite(root);
  };

  const withPermission = async (action: (root: FileSystemDirectoryHandle) => Promise<void>) => {
    if (!folder) return;
    if (!(await ensureWritePermission(folder))) {
      setStatus({ kind: "error", message: "El navegador no dio permiso para usar la carpeta." });
      return;
    }
    await action(folder);
  };

  const handleImport = (root: FileSystemDirectoryHandle) => runImport(root);

  const runImport = async (root: FileSystemDirectoryHandle) => {
    setStatus({ kind: "busy", label: "Buscando imágenes nuevas…" });
    try {
      const scan = await scanNewFiles(root);
      const { importFiles } = useAssetStore.getState();
      const editor = useEditorStore.getState();
      const imported: Array<{ path: string; assetId: string }> = [];

      // Biblioteca: uno a uno para saber qué archivo corresponde a cada asset.
      for (const f of scan.library) {
        const [meta] = await importFiles([f.file], "library");
        if (meta) imported.push({ path: f.path, assetId: meta.id });
      }

      // Personajes: carpeta → ficha (se crea si no existe).
      let createdCharacters = 0;
      let characterImages = 0;
      for (const [folderName, byCategory] of scan.characters) {
        const current = useEditorStore.getState().project!;
        let character = current.characters.find(
          (ch) => characterFolder(ch.name).toLowerCase() === folderName.toLowerCase(),
        );
        if (!character) {
          character = createCharacter(
            folderName.replace(/_/g, " "),
            CHARACTER_COLORS[current.characters.length % CHARACTER_COLORS.length],
          );
          editor.addCharacter(character);
          createdCharacters++;
        }
        for (const [category, files] of byCategory) {
          const images = [];
          for (const f of files) {
            const [meta] = await importFiles([f.file], "character");
            if (!meta) continue;
            imported.push({ path: f.path, assetId: meta.id });
            images.push({ id: newId("ci_"), assetId: meta.id, category, label: f.file.name.replace(/\.[^.]+$/, "") });
          }
          editor.addCharacterImages(character.id, images);
          characterImages += images.length;
        }
      }

      if (imported.length) await recordImported(root, useEditorStore.getState().project!, imported);

      const libraryCount = imported.length - characterImages;
      setStatus({
        kind: "done",
        message: imported.length
          ? [
              libraryCount ? `${plural(libraryCount, "imagen", "imágenes")} en la biblioteca` : null,
              characterImages ? `${plural(characterImages, "referencia", "referencias")} de personajes` : null,
              createdCharacters ? `${plural(createdCharacters, "personaje nuevo", "personajes nuevos")}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : "No hay imágenes nuevas en la carpeta.",
      });
    } catch (err) {
      console.error(err);
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "No se pudo leer la carpeta" });
    } finally {
      setProgress(null);
    }
  };

  const handleUnlink = async () => {
    await unlinkFolder(project.id);
    setFolder(null);
    setStatus({ kind: "idle" });
  };

  const handleClose = () => {
    if (isBusy) return;
    setStatus({ kind: "idle" });
    onClose();
  };

  const percent = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  const folderLabel = safeFileName(project.title);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Empaquetar proyecto"
      description="Guarda el proyecto en una carpeta de tu disco, ordenada por imágenes, personajes y páginas."
      className="w-[min(94vw,620px)]"
      footer={
        <Button variant="ghost" onClick={handleClose} disabled={isBusy}>
          Cerrar
        </Button>
      }
    >
      {!isSupported ? (
        <p className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Este navegador no permite escribir en carpetas del disco. Abre Koma Studio en Chrome, Edge o Brave para
          empaquetar.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <pre className="overflow-x-auto rounded-lg border border-line bg-surface-0 px-4 py-3 font-mono text-[11px] leading-relaxed text-zinc-400">
            {`${folder?.name ?? folderLabel}/
├─ imagenes/            ← suelta aquí lo que descargues
├─ personajes/
│  └─ <Nombre>/ cuerpo/ rostro/ ropa/ variantes/
├─ paginas/             001_pagina.png…
└─ proyecto.koma.json`}
          </pre>

          {folder ? (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                <FolderOpen className="size-4 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-zinc-500">Carpeta vinculada</p>
                  <p className="truncate text-sm font-medium">{folder.name}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={handleChooseFolder} disabled={isBusy}>
                  Cambiar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Unlink className="size-3.5" />}
                  onClick={handleUnlink}
                  disabled={isBusy}
                  aria-label="Desvincular carpeta"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  variant="primary"
                  icon={<FolderSync className="size-4" />}
                  onClick={() => withPermission(runWrite)}
                  disabled={isBusy}
                >
                  Actualizar paquete
                </Button>
                <Button
                  icon={<FolderInput className="size-4" />}
                  onClick={() => withPermission(handleImport)}
                  disabled={isBusy}
                >
                  Importar imágenes nuevas
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Descarga o arrastra imágenes a <span className="text-zinc-300">imagenes/</span> (o a las carpetas de{" "}
                <span className="text-zinc-300">personajes/</span>) y pulsa{" "}
                <span className="text-zinc-300">Importar imágenes nuevas</span>. Una carpeta nueva dentro de
                personajes/ con subcarpetas {Object.values(CATEGORY_FOLDERS).join(", ")} crea un personaje.
              </p>
            </>
          ) : (
            <Button variant="primary" icon={<FolderOpen className="size-4" />} onClick={handleChooseFolder} disabled={isBusy}>
              Elegir ubicación y empaquetar
            </Button>
          )}

          <label className="flex cursor-pointer items-center gap-2.5 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={includePages}
              onChange={(e) => setIncludePages(e.target.checked)}
              disabled={isBusy}
              className="size-4 accent-[var(--color-accent)]"
            />
            Incluir las páginas renderizadas en PNG (2×) en <span className="font-mono">paginas/</span>
          </label>

          {isBusy && (
            <div className="flex flex-col gap-2" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin text-accent" />
                  {progress ? `${PHASE[progress.phase]} ${progress.done + 1} de ${progress.total}` : status.label}
                </span>
                {progress && <span className="text-zinc-500 tabular-nums">{percent}%</span>}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}
          {status.kind === "done" && (
            <p className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="mt-px size-4 shrink-0" />
              {status.message}
            </p>
          )}
          {status.kind === "error" && (
            <p className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
              <AlertTriangle className="mt-px size-4 shrink-0" />
              {status.message}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
