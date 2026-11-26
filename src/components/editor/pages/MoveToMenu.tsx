"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Folder, FolderMinus, FolderPlus } from "lucide-react";
import type { PageSection } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  anchor: HTMLElement;
  pageCount: number;
  sections: Array<PageSection & { size: number }>;
  /** Subcategoría en la que ya están TODAS las páginas (se marca). */
  currentSectionId: string | null;
  /** Alguna de las páginas está en una subcategoría (se ofrece sacarlas). */
  isAnyInSection: boolean;
  onMoveToSection: (sectionId: string) => void;
  onRemoveFromSection: () => void;
  onCreateSection: () => void;
  onClose: () => void;
};

/** Menú "Mover a…": la forma sin arrastrar de meter o sacar páginas de subcategorías. */
export function MoveToMenu({
  anchor,
  pageCount,
  sections,
  currentSectionId,
  isAnyInSection,
  onMoveToSection,
  onRemoveFromSection,
  onCreateSection,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  // Posición junto al botón, sin salirse de la ventana.
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const h = ref.current?.offsetHeight ?? 200;
    setPos({ left: r.right + 6, top: Math.min(r.top, window.innerHeight - h - 8) });
  }, [anchor]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handlePointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchor.focus();
      }
    };
    window.addEventListener("pointerdown", handlePointer, true);
    window.addEventListener("keydown", handleKey, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointer, true);
      window.removeEventListener("keydown", handleKey, true);
    };
  }, [anchor, onClose]);

  const item =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-200 transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none";

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Mover a"
      className="fixed z-50 w-56 rounded-xl border border-line bg-surface-1 p-1 shadow-2xl shadow-black/60"
      style={{ left: pos.left, top: pos.top }}
    >
      <p className="px-2 pt-1 pb-1.5 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
        Mover {pageCount > 1 ? `${pageCount} páginas` : "la página"} a…
      </p>
      {sections.map((s) => {
        const isCurrent = s.id === currentSectionId;
        return (
          <button
            key={s.id}
            type="button"
            role="menuitem"
            disabled={isCurrent}
            onClick={() => onMoveToSection(s.id)}
            className={cn(item, isCurrent && "pointer-events-none text-zinc-500")}
          >
            <Folder className="size-3.5 shrink-0 text-accent" />
            <span className="truncate">{s.name || "Sin nombre"}</span>
            <span className="ml-auto shrink-0 text-[10px] text-zinc-500 tabular-nums">
              {isCurrent ? <Check className="size-3.5" /> : s.size}
            </span>
          </button>
        );
      })}
      {sections.length > 0 && <div className="my-1 h-px bg-line" />}
      {isAnyInSection && (
        <button type="button" role="menuitem" onClick={onRemoveFromSection} className={item}>
          <FolderMinus className="size-3.5 shrink-0 text-zinc-400" />
          Sin subcategoría
        </button>
      )}
      <button type="button" role="menuitem" onClick={onCreateSection} className={item}>
        <FolderPlus className="size-3.5 shrink-0 text-zinc-400" />
        Nueva subcategoría…
      </button>
      <p className="px-2 pt-1.5 pb-1 text-[10px] leading-snug text-zinc-600">Se añaden al final de la subcategoría.</p>
    </div>
  );
}
