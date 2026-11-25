"use client";

import Link from "next/link";
import { Copy, Trash2 } from "lucide-react";
import { PagePreview } from "@/components/shared/PagePreview";
import { IconButton } from "@/components/ui/Button";
import { getFormat } from "@/lib/formats";
import type { Project } from "@/lib/types";
import { formatChapter, relativeTime } from "@/lib/utils";

type Props = {
  project: Project;
  onDuplicate: (id: string) => void;
  onDelete: (project: Project) => void;
};

export function ProjectCard({ project, onDuplicate, onDelete }: Props) {
  const format = getFormat(project.formatId);
  const cover = project.pages[0];
  const pageCount = project.pages.length;
  const directionLabel = project.readingDirection === "rtl" ? "Manga ←" : "Occidental →";

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-1 transition-colors duration-200 hover:border-line-strong">
      <Link
        href={`/editor/${project.id}`}
        className="flex flex-col focus-visible:outline-offset-[-2px]"
        aria-label={`Abrir ${project.title}`}
      >
        <div className="workspace-bg flex aspect-[4/3] items-center justify-center overflow-hidden p-5">
          {cover && (
            <div className="h-full shadow-lg shadow-black/50 transition-transform duration-300 ease-out group-hover:-translate-y-1">
              <PagePreview
                format={format}
                style={cover.style}
                panels={cover.panels}
                elements={cover.elements}
                isBleed={cover.bleed}
                className="h-full w-auto"
              />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 px-4 pt-3 pb-4">
          <h3 className="truncate text-sm font-semibold tracking-tight">{project.title}</h3>
          <p className="truncate text-xs text-zinc-400">{formatChapter(project.chapterNumber, project.chapterTitle)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-zinc-300">{format.label}</span>
            <span className="rounded-md bg-surface-3 px-1.5 py-0.5">{directionLabel}</span>
            <span>
              · {pageCount} {pageCount === 1 ? "página" : "páginas"}
            </span>
            <span className="ml-auto">{relativeTime(project.updatedAt)}</span>
          </div>
        </div>
      </Link>

      <div className="absolute top-2.5 right-2.5 flex gap-1 rounded-lg border border-line bg-surface-1/90 p-0.5 opacity-0 backdrop-blur transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton label="Duplicar proyecto" size="sm" onClick={() => onDuplicate(project.id)}>
          <Copy className="size-3.5" />
        </IconButton>
        <IconButton
          label="Eliminar proyecto"
          size="sm"
          onClick={() => onDelete(project)}
          className="hover:text-red-300"
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </article>
  );
}
