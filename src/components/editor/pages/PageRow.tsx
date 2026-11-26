"use client";

import { useDraggable } from "@dnd-kit/core";
import { Check, Copy, FolderInput, Trash2 } from "lucide-react";
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
  /** Esta página va en el arrastre en curso (se atenúa en su sitio). */
  isBeingDragged: boolean;
  canDelete: boolean;
  measureRef: (el: HTMLElement | null) => void;
  onClick: (e: React.MouseEvent) => void;
  /** Alt+↑ / Alt+↓ con la miniatura enfocada. */
  onNudge: (direction: -1 | 1) => void;
  onMoveTo: (anchor: HTMLElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

/**
 * Miniatura de página en el panel lateral. Toda la miniatura se arrastra con
 * el ratón (un clic sin mover la abre). Sin ratón: "Mover a…" o Alt+↑/↓.
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
  isBeingDragged,
  canDelete,
  measureRef,
  onClick,
  onNudge,
  onMoveTo,
  onDuplicate,
  onDelete,
}: Props) {
  const { listeners, setNodeRef } = useDraggable({ id: rowId });
  const printed = numbering.startAt + index;
  const label = formatPageNumber(printed);
  const isTall = format.height / format.width > 2;
  const showCheck = isMultiSelecting && isSelected;

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        measureRef(el);
      }}
      className={cn(
        "group relative flex gap-2 transition-opacity duration-150",
        // Dentro de una subcategoría: sangría y guía vertical.
        isInSection && "ml-2.5 border-l border-line-strong pl-2",
        isBeingDragged && "opacity-30",
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
      </div>

      <button
        type="button"
        onClick={onClick}
        onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLButtonElement> | undefined}
        onKeyDown={(e) => {
          if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            e.stopPropagation();
            onNudge(e.key === "ArrowUp" ? -1 : 1);
          }
        }}
        aria-current={isActive ? "page" : undefined}
        aria-pressed={isMultiSelecting ? isSelected : undefined}
        aria-label={`Página ${label}`}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        title="Clic: abrir · ⌘/Ctrl+clic o Shift+clic: elegir varias · arrastra para mover"
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
        <IconButton
          label={isMultiSelecting && isSelected ? "Mover las seleccionadas a…" : "Mover a…"}
          size="sm"
          onClick={(e) => onMoveTo(e.currentTarget)}
        >
          <FolderInput className="size-3.5" />
        </IconButton>
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
