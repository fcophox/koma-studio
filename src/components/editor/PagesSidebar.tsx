"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { PagePreview } from "@/components/shared/PagePreview";
import { IconButton } from "@/components/ui/Button";
import { getFormat } from "@/lib/formats";
import { useEditorStore } from "@/lib/store/editor-store";
import type { Page, PageFormat, PageNumbering, ReadingDirection } from "@/lib/types";
import { cn, formatPageNumber } from "@/lib/utils";
import { TemplatePickerDialog } from "./TemplatePickerDialog";

type ThumbProps = {
  page: Page;
  index: number;
  format: PageFormat;
  numbering: PageNumbering;
  direction: ReadingDirection;
  isActive: boolean;
  canDelete: boolean;
};

function SortablePageThumb({ page, index, format, numbering, direction, isActive, canDelete }: ThumbProps) {
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const printed = numbering.startAt + index;
  const isTall = format.height / format.width > 2;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative flex gap-2", isDragging && "z-10 opacity-80")}
    >
      <div className="flex w-5 flex-col items-center pt-1">
        <span className={cn("text-[11px] font-medium tabular-nums", isActive ? "text-accent" : "text-zinc-500")}>
          {formatPageNumber(printed)}
        </span>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reordenar página ${formatPageNumber(printed)}`}
          className="mt-1 cursor-grab rounded p-0.5 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-300 focus-visible:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setActivePage(page.id)}
        aria-current={isActive ? "page" : undefined}
        aria-label={`Página ${formatPageNumber(printed)}`}
        className={cn(
          "relative flex-1 overflow-hidden rounded-[4px] ring-offset-2 ring-offset-surface-1 transition-shadow duration-150",
          isTall && "aspect-[1/2]",
          isActive ? "ring-2 ring-accent" : "ring-1 ring-line hover:ring-line-strong",
          isDragging && "shadow-xl shadow-black/60",
        )}
      >
        <PagePreview
          format={format}
          style={page.style}
          panels={page.panels}
          elements={page.elements}
          isBleed={page.bleed}
          numbering={numbering}
          printedNumber={printed}
          direction={direction}
          className={isTall ? "h-full w-full bg-white" : undefined}
        />
      </button>

      <div className="absolute top-1 right-1 flex flex-col gap-0.5 rounded-md border border-line bg-surface-1/95 p-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton label="Duplicar página" size="sm" onClick={() => duplicatePage(page.id)}>
          <Copy className="size-3.5" />
        </IconButton>
        <IconButton
          label="Eliminar página"
          size="sm"
          disabled={!canDelete}
          onClick={() => deletePage(page.id)}
          className="hover:text-red-300"
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </li>
  );
}

export function PagesSidebar() {
  const project = useEditorStore((s) => s.project);
  const activePageId = useEditorStore((s) => s.activePageId);
  const movePage = useEditorStore((s) => s.movePage);
  const addPage = useEditorStore((s) => s.addPage);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!project) return null;
  const format = getFormat(project.formatId);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = project.pages.findIndex((p) => p.id === active.id);
    const to = project.pages.findIndex((p) => p.id === over.id);
    movePage(from, to);
  };

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-line bg-surface-1" aria-label="Páginas">
      <div className="flex h-10 items-center justify-between px-3">
        <h2 className="text-xs font-medium text-zinc-400">
          Páginas <span className="text-zinc-600 tabular-nums">· {project.pages.length}</span>
        </h2>
        <IconButton label="Añadir página" size="sm" onClick={() => setIsPickerOpen(true)}>
          <Plus className="size-4" />
        </IconButton>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={project.pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-3 pt-1">
              {project.pages.map((page, i) => (
                <SortablePageThumb
                  key={page.id}
                  page={page}
                  index={i}
                  format={format}
                  numbering={project.numbering}
                  direction={project.readingDirection}
                  isActive={page.id === activePageId}
                  canDelete={project.pages.length > 1}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="mt-3 ml-7 flex w-[calc(100%-1.75rem)] items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong py-3 text-xs text-zinc-400 transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="size-3.5" /> Añadir página
        </button>
      </div>

      <TemplatePickerDialog
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onPick={(templateId) => addPage(templateId)}
      />
    </aside>
  );
}
