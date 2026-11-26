"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Copy, GripVertical, Trash2 } from "lucide-react";
import { PagePreview } from "@/components/shared/PagePreview";
import { IconButton } from "@/components/ui/Button";
import type { Page, PageFormat, PageNumbering, ReadingDirection } from "@/lib/types";
import { cn, formatPageNumber } from "@/lib/utils";

type Props = {
  rowId: string;
  page: Page;
  index: number;
  format: PageFormat;
  numbering: PageNumbering;
  direction: ReadingDirection;
  isInSection: boolean;
  isActive: boolean;
  isSelected: boolean;
  /** Hay más de una página seleccionada (se muestra la marca de selección). */
  isMultiSelecting: boolean;
  /** Miniaturas pequeñas para ver y mover muchas páginas a la vez. */
  isCompact: boolean;
  canDelete: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/**
 * Miniatura de página en el panel lateral. Toda la miniatura se arrastra con
 * el ratón (un clic sin mover la abre); el teclado usa el asa ⋮⋮.
 */
export function PageRow({
  rowId,
  page,
  index,
  format,
  numbering,
  direction,
  isInSection,
  isActive,
  isSelected,
  isMultiSelecting,
  isCompact,
  canDelete,
  onClick,
  onDuplicate,
  onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: rowId,
  });
  const printed = numbering.startAt + index;
  const label = formatPageNumber(printed);
  const isTall = format.height / format.width > 2;
  const showCheck = isMultiSelecting && isSelected;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex gap-2",
        // Dentro de una subcategoría: sangría y guía vertical.
        isInSection && "ml-2.5 border-l border-line-strong pl-2",
        isDragging && "opacity-30",
      )}
    >
      <div className="flex w-5 flex-col items-center pt-1">
        <span
          className={cn(
            "text-[11px] font-medium tabular-nums",
            isActive ? "text-accent" : isSelected ? "text-zinc-200" : "text-zinc-500",
          )}
        >
          {label}
        </span>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reordenar página ${label}`}
          className="mt-1 cursor-grab rounded p-0.5 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-300 focus-visible:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onClick}
        onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLButtonElement> | undefined}
        aria-current={isActive ? "page" : undefined}
        aria-pressed={isMultiSelecting ? isSelected : undefined}
        aria-label={`Página ${label}`}
        title="Clic: abrir · ⌘/Ctrl+clic: añadir a la selección · Shift+clic: rango · arrastra para mover"
        className={cn(
          "relative cursor-grab touch-none overflow-hidden rounded-[4px] ring-offset-2 ring-offset-surface-1 transition-shadow duration-150 active:cursor-grabbing",
          isCompact ? "w-[72px] flex-none" : "flex-1",
          isTall && "aspect-[1/2]",
          isActive
            ? "ring-2 ring-accent"
            : isSelected
              ? "ring-2 ring-accent/50"
              : "ring-1 ring-line hover:ring-line-strong",
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
        {isSelected && isMultiSelecting && <span className="pointer-events-none absolute inset-0 bg-accent/10" />}
        {showCheck && (
          <span className="absolute top-1 left-1 flex size-4 items-center justify-center rounded-full bg-accent text-white shadow">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </button>

      <div className="absolute top-1 right-1 flex flex-col gap-0.5 rounded-md border border-line bg-surface-1/95 p-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton label="Duplicar página" size="sm" onClick={onDuplicate}>
          <Copy className="size-3.5" />
        </IconButton>
        <IconButton label="Eliminar página" size="sm" disabled={!canDelete} onClick={onDelete} className="hover:text-red-300">
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>
    </li>
  );
}
