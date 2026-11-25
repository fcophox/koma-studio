"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, HardDrive, Plus } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteProject, duplicateProject, listProjects, saveProject } from "@/lib/db";
import { createProject, type NewProjectInput } from "@/lib/factory";
import type { Project } from "@/lib/types";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectCard } from "./ProjectCard";

type LoadState = "loading" | "ready" | "error";

export function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
      setLoadState("ready");
    } catch (err) {
      console.error(err);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    // IndexedDB es un sistema externo: cargar al montar es sincronizar con él.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const handleCreate = async (input: NewProjectInput) => {
    const project = createProject(input);
    await saveProject(project);
    setIsCreating(false);
    router.push(`/editor/${project.id}`);
  };

  const handleDuplicate = async (id: string) => {
    await duplicateProject(id);
    await refresh();
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteProject(pendingDelete.id);
    setPendingDelete(null);
    await refresh();
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-surface-0/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Logo />
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setIsCreating(true)}>
            Nuevo proyecto
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">Tus proyectos</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
              <HardDrive className="size-3.5" />
              Guardados localmente en este navegador. Nada sale de tu equipo.
            </p>
          </div>
          {loadState === "ready" && projects.length > 0 && (
            <span className="text-sm text-zinc-500 tabular-nums">
              {projects.length} {projects.length === 1 ? "proyecto" : "proyectos"}
            </span>
          )}
        </div>

        {loadState === "loading" && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="aspect-[4/4.2] animate-pulse rounded-2xl border border-line bg-surface-1" />
            ))}
          </div>
        )}

        {loadState === "error" && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            No se pudo abrir IndexedDB. Revisa que el navegador no esté en modo privado estricto.
          </p>
        )}

        {loadState === "ready" && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong px-6 py-24 text-center">
            <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <BookOpen className="size-6" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Empieza tu primer capítulo</h2>
            <p className="mt-1.5 max-w-sm text-sm text-pretty text-zinc-400">
              Elige formato y dirección de lectura, y maqueta viñetas, globos y onomatopeyas página a página.
            </p>
            <Button
              variant="primary"
              className="mt-6"
              icon={<Plus className="size-4" />}
              onClick={() => setIsCreating(true)}
            >
              Crear proyecto
            </Button>
          </div>
        )}

        {loadState === "ready" && projects.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onDuplicate={handleDuplicate} onDelete={setPendingDelete} />
            ))}
          </div>
        )}
      </main>

      <NewProjectDialog isOpen={isCreating} onClose={() => setIsCreating(false)} onCreate={handleCreate} />
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="¿Eliminar proyecto?"
        message={`Se borrarán "${pendingDelete?.title ?? ""}" y todas sus imágenes de este navegador. No se puede deshacer.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
