"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getProject } from "@/lib/db";
import { useAssetStore } from "@/lib/store/asset-store";
import { startAutosave } from "@/lib/store/autosave";
import { useEditorStore } from "@/lib/store/editor-store";
import { useEditorShortcuts } from "@/lib/hooks/use-editor-shortcuts";
import { EditorCanvas } from "./canvas/EditorCanvas";
import { EditorHeader } from "./EditorHeader";
import { PagesSidebar } from "./PagesSidebar";
import { ToolsSidebar } from "./ToolsSidebar";

type Status = "loading" | "ready" | "not-found";

export function EditorScreen({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const loadProject = useEditorStore((s) => s.loadProject);
  const closeProject = useEditorStore((s) => s.closeProject);

  useEffect(() => {
    let isCancelled = false;
    let autosave: ReturnType<typeof startAutosave> | null = null;

    getProject(projectId).then((project) => {
      if (isCancelled) return;
      if (!project) {
        setStatus("not-found");
        return;
      }
      loadProject(project);
      void useAssetStore.getState().load(project.id);
      autosave = startAutosave();
      setStatus("ready");
    });

    return () => {
      isCancelled = true;
      autosave?.stop();
      closeProject();
      useAssetStore.getState().reset();
    };
  }, [projectId, loadProject, closeProject]);

  useEditorShortcuts(status === "ready");

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-500">
        <Loader2 className="size-5 animate-spin" aria-label="Cargando proyecto" />
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-zinc-300">Este proyecto no existe en este navegador.</p>
        <Link href="/" className="text-sm text-accent hover:underline">
          Volver a tus proyectos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <EditorHeader />
      <div className="flex min-h-0 flex-1">
        <PagesSidebar />
        <main className="relative min-w-0 flex-1">
          <EditorCanvas />
        </main>
        <ToolsSidebar />
      </div>
    </div>
  );
}
