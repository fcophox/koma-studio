"use client";

import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  ClipboardCopy,
  ClipboardPaste,
  CopyPlus,
  Scissors,
  Trash2,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { copySelectionFromButton, pasteClipboard } from "@/lib/clipboard";
import { FONT_OPTIONS } from "@/lib/fonts";
import type { FontStyle } from "@/lib/types";
import { cn, modKeyLabel } from "@/lib/utils";
import { useEditorStore } from "@/lib/store/editor-store";

type Props = {
  pageId: string;
  elementId: string;
};

/** Copiar/cortar/pegar, orden de capas (z-index), duplicar y eliminar para globos y onomatopeyas. */
export function ElementActions({ pageId, elementId }: Props) {
  const reorder = useEditorStore((s) => s.reorderElement);
  const duplicate = useEditorStore((s) => s.duplicateElement);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const canPaste = useEditorStore((s) => s.clipboard?.kind === "element");
  const mod = modKeyLabel();

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <Button
          size="sm"
          icon={<ClipboardCopy className="size-3.5" />}
          onClick={() => copySelectionFromButton("copy")}
          title={`${mod}C`}
        >
          Copiar
        </Button>
        <Button
          size="sm"
          icon={<Scissors className="size-3.5" />}
          onClick={() => copySelectionFromButton("cut")}
          title={`${mod}X`}
        >
          Cortar
        </Button>
        <Button
          size="sm"
          icon={<ClipboardPaste className="size-3.5" />}
          onClick={() => pasteClipboard()}
          disabled={!canPaste}
          title={`Pega el globo u onomatopeya copiado (${mod}V)`}
        >
          Pegar
        </Button>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2 p-0.5">
        <div className="flex">
          <IconButton label="Enviar al fondo (Ctrl+Shift+[)" size="sm" onClick={() => reorder(pageId, elementId, "back")}>
            <ArrowDownToLine className="size-3.5" />
          </IconButton>
          <IconButton label="Enviar atrás (Ctrl+[)" size="sm" onClick={() => reorder(pageId, elementId, "backward")}>
            <ArrowDown className="size-3.5" />
          </IconButton>
          <IconButton label="Traer adelante (Ctrl+])" size="sm" onClick={() => reorder(pageId, elementId, "forward")}>
            <ArrowUp className="size-3.5" />
          </IconButton>
          <IconButton label="Traer al frente (Ctrl+Shift+])" size="sm" onClick={() => reorder(pageId, elementId, "front")}>
            <ArrowUpToLine className="size-3.5" />
          </IconButton>
        </div>
        <div className="flex">
          <IconButton label={`Duplicar (${mod}D)`} size="sm" onClick={() => duplicate(pageId, elementId)}>
            <CopyPlus className="size-3.5" />
          </IconButton>
          <IconButton label="Eliminar (Supr)" size="sm" onClick={deleteSelection} className="hover:text-red-300">
            <Trash2 className="size-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

export function FontSelect({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-lg border border-line bg-surface-2 px-2 text-xs focus:border-accent focus:outline-none"
    >
      <FontOptions />
    </select>
  );
}


function FontOptions() {
  return (
    <>
      {FONT_OPTIONS.map((f) => (
        <option key={f.id} value={f.id}>
          {f.label}
        </option>
      ))}
    </>
  );
}

/** Botones B / I que combinan el fontStyle de Konva ("italic bold"…). */
export function FontStyleToggles({ value, onChange }: { value: FontStyle; onChange: (v: FontStyle) => void }) {
  const isBold = value.includes("bold");
  const isItalic = value.includes("italic");
  const compose = (bold: boolean, italic: boolean): FontStyle =>
    bold && italic ? "italic bold" : bold ? "bold" : italic ? "italic" : "normal";
  const btn = "h-8 w-8 shrink-0 rounded-md border text-xs transition-colors";
  const on = "border-accent bg-accent-soft text-accent";
  const off = "border-line bg-surface-2 text-zinc-300 hover:border-line-strong";
  return (
    <div className="flex gap-1">
      <button
        type="button"
        aria-pressed={isBold}
        title="Negrita"
        onClick={() => onChange(compose(!isBold, isItalic))}
        className={cn(btn, "font-bold", isBold ? on : off)}
      >
        B
      </button>
      <button
        type="button"
        aria-pressed={isItalic}
        title="Cursiva"
        onClick={() => onChange(compose(isBold, !isItalic))}
        className={cn(btn, "italic", isItalic ? on : off)}
      >
        I
      </button>
    </div>
  );
}

export function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
      <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{title}</h3>
      {children}
    </section>
  );
}
