"use client";

import type { ReactNode } from "react";
import { ClipboardPaste, Copy, Crop, ImageOff, ImagePlus, Scissors } from "lucide-react";
import type { Rect } from "@/lib/geometry";
import { cn } from "@/lib/utils";

type Props = {
  /** Caja de la viñeta en coordenadas de página. */
  box: Rect;
  view: { scale: number; x: number; y: number };
  panelNumber: number;
  hasImage: boolean;
  canPaste: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onFrame: () => void;
  onRemove: () => void;
  onPickFile: () => void;
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl+";

function Action({
  label,
  shortcut,
  onClick,
  isPrimary,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  isPrimary?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors",
        isPrimary ? "bg-accent text-white hover:bg-accent-hover" : "text-zinc-300 hover:bg-surface-3 hover:text-zinc-100",
      )}
    >
      {children}
    </button>
  );
}

/** Acciones rápidas sobre la viñeta seleccionada, ancladas encima de ella. */
export function PanelActionBar({
  box,
  view,
  panelNumber,
  hasImage,
  canPaste,
  onCopy,
  onCut,
  onPaste,
  onFrame,
  onRemove,
  onPickFile,
}: Props) {
  const s = view.scale;
  const left = view.x + (box.x + box.width / 2) * s;
  const top = view.y + box.y * s;
  // Si no cabe encima (viñeta pegada al borde superior), se coloca dentro.
  const isInside = top < 56;

  return (
    <div
      role="toolbar"
      aria-label={`Acciones de la viñeta ${panelNumber}`}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-10 flex items-center gap-0.5 rounded-lg border border-line bg-surface-1/95 p-0.5 shadow-lg shadow-black/50 backdrop-blur"
      style={{
        left,
        top: isInside ? top + 8 : top - 8,
        transform: `translate(-50%, ${isInside ? "0" : "-100%"})`,
      }}
    >
      <span className="px-1.5 text-[10px] font-semibold text-accent tabular-nums">#{panelNumber}</span>
      {hasImage ? (
        <>
          <Action label="Copiar" shortcut={`${MOD}C`} onClick={onCopy}>
            <Copy className="size-3.5" /> Copiar
          </Action>
          <Action label="Cortar" shortcut={`${MOD}X`} onClick={onCut}>
            <Scissors className="size-3.5" /> Cortar
          </Action>
          {canPaste && (
            <Action label="Pegar (reemplaza)" shortcut={`${MOD}V`} onClick={onPaste}>
              <ClipboardPaste className="size-3.5" /> Pegar
            </Action>
          )}
          <div className="mx-0.5 h-4 w-px bg-line" />
          <Action label="Encuadrar" shortcut="Enter" onClick={onFrame}>
            <Crop className="size-3.5" />
          </Action>
          <Action label="Quitar imagen" shortcut="Supr" onClick={onRemove}>
            <ImageOff className="size-3.5" />
          </Action>
        </>
      ) : (
        <>
          {canPaste && (
            <Action label="Pegar aquí" shortcut={`${MOD}V`} onClick={onPaste} isPrimary>
              <ClipboardPaste className="size-3.5" /> Pegar aquí
            </Action>
          )}
          <Action label="Elegir imagen" onClick={onPickFile}>
            <ImagePlus className="size-3.5" /> {canPaste ? "" : "Elegir imagen"}
          </Action>
        </>
      )}
    </div>
  );
}
