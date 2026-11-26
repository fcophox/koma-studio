"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Folder, GripVertical, Pencil, Trash2, Ungroup } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import type { PageSection } from "@/lib/types";
import { cn, formatPageNumber } from "@/lib/utils";

/** Campo de nombre: se monta al empezar a editar, así siempre parte del nombre actual. */
function RenameInput({ name, onRename, onEndEdit }: { name: string; onRename: (n: string) => void; onEndEdit: () => void }) {
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    onEndEdit();
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      aria-label="Nombre de la subcategoría"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onEndEdit();
      }}
      className="h-7 min-w-0 flex-1 rounded-md border border-accent bg-surface-0 px-1.5 text-xs text-zinc-100 focus:outline-none"
    />
  );
}

type Props = {
  rowId: string;
  section: PageSection;
  pageCount: number;
  firstNumber: number;
  isCollapsed: boolean;
  isEditing: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelectPages: (e: React.MouseEvent) => void;
  onStartEdit: () => void;
  onRename: (name: string) => void;
  onEndEdit: () => void;
  onUngroup: () => void;
  onDelete: () => void;
};

/**
 * Encabezado de subcategoría: se pliega/despliega con un clic, el nombre se
 * edita con doble clic (o el lápiz) y se arrastra entera con todas sus páginas.
 */
export function SectionHeaderRow({
  rowId,
  section,
  pageCount,
  firstNumber,
  isCollapsed,
  isEditing,
  isSelected,
  onToggle,
  onSelectPages,
  onStartEdit,
  onRename,
  onEndEdit,
  onUngroup,
  onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: rowId,
  });
  const range =
    pageCount > 1
      ? `${formatPageNumber(firstNumber)}–${formatPageNumber(firstNumber + pageCount - 1)}`
      : formatPageNumber(firstNumber);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative", isDragging && "opacity-30")}
    >
      <div
        className={cn(
          "relative flex h-9 items-center gap-1 rounded-lg border pr-1 pl-0.5 transition-colors",
          isSelected ? "border-accent/50 bg-accent-soft" : "border-line bg-surface-2 hover:border-line-strong",
        )}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover la subcategoría ${section.name}`}
          className="cursor-grab rounded p-0.5 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-300 focus-visible:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? `Expandir ${section.name}` : `Colapsar ${section.name}`}
          className="flex size-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-surface-3 hover:text-zinc-100"
        >
          <ChevronRight className={cn("size-3.5 transition-transform duration-150", !isCollapsed && "rotate-90")} />
        </button>

        {isEditing ? (
          <RenameInput name={section.name} onRename={onRename} onEndEdit={onEndEdit} />
        ) : (
          <button
            type="button"
            // Clic: seleccionar sus páginas · doble clic: renombrar · arrastrar: mover la subcategoría.
            onClick={onSelectPages}
            onDoubleClick={onStartEdit}
            onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLButtonElement> | undefined}
            title="Clic: seleccionar sus páginas · doble clic: renombrar · arrastra para mover la subcategoría"
            className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-1.5 text-left active:cursor-grabbing"
          >
            <Folder className="size-3.5 shrink-0 text-accent" />
            <span className="truncate text-xs font-medium text-zinc-100">{section.name || "Sin nombre"}</span>
            <span className="ml-auto shrink-0 text-[10px] text-zinc-500 tabular-nums">{range}</span>
          </button>
        )}

        {!isEditing && (
          // Superpuestas sobre el rango de páginas: el nombre sigue a la vista.
          <div className="absolute top-1/2 right-1 hidden -translate-y-1/2 items-center rounded-md bg-surface-2 pl-1 shadow-[-8px_0_8px_-4px_var(--color-surface-2)] group-focus-within:flex group-hover:flex">
            <IconButton label="Renombrar" size="sm" onClick={onStartEdit} className="size-6">
              <Pencil className="size-3" />
            </IconButton>
            <IconButton label="Desagrupar (las páginas se quedan)" size="sm" onClick={onUngroup} className="size-6">
              <Ungroup className="size-3" />
            </IconButton>
            <IconButton
              label={`Eliminar la subcategoría y sus ${pageCount} página(s)`}
              size="sm"
              onClick={onDelete}
              className="size-6 hover:text-red-300"
            >
              <Trash2 className="size-3" />
            </IconButton>
          </div>
        )}
      </div>
      {isCollapsed && (
        <p className="mt-0.5 ml-8 text-[10px] text-zinc-500">
          {pageCount} {pageCount === 1 ? "página" : "páginas"} plegadas
        </p>
      )}
    </li>
  );
}
