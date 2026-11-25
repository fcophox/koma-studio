"use client";

import { ArrowDown, ArrowUp, Image as ImageIcon, MessageCircle, Square, Zap } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { selectActivePage, useEditorStore } from "@/lib/store/editor-store";
import type { CanvasElement } from "@/lib/types";
import { cn } from "@/lib/utils";

const BUBBLE_LABEL: Record<string, string> = {
  oval: "Globo",
  thought: "Pensamiento",
  shout: "Grito",
  whisper: "Susurro",
  narration: "Narración",
};

function elementLabel(el: CanvasElement) {
  const text = el.text.replace(/\s+/g, " ").trim() || "(vacío)";
  return el.type === "bubble" ? `${BUBBLE_LABEL[el.kind]}: ${text}` : text;
}

/** Capas de la página activa: elementos libres (arriba = al frente) y viñetas. */
export function LayersTab() {
  const page = useEditorStore(selectActivePage);
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const reorder = useEditorStore((s) => s.reorderElement);

  if (!page) return null;
  const topFirst = [...page.elements].reverse();

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
        Globos y onomatopeyas <span className="text-zinc-600">· arriba = al frente</span>
      </h3>
      {topFirst.length === 0 && <p className="text-xs text-zinc-500">Sin globos ni onomatopeyas todavía.</p>}
      <ul className="flex flex-col gap-0.5">
        {topFirst.map((el, i) => {
          const isSelected = selection?.kind === "element" && selection.elementId === el.id;
          return (
            <li key={el.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => select({ kind: "element", pageId: page.id, elementId: el.id })}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  isSelected ? "bg-accent-soft text-accent" : "text-zinc-300 hover:bg-surface-3",
                )}
              >
                {el.type === "bubble" ? (
                  <MessageCircle className="size-3.5 shrink-0" />
                ) : (
                  <Zap className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{elementLabel(el)}</span>
              </button>
              <IconButton
                label="Subir una capa"
                size="sm"
                disabled={i === 0}
                onClick={() => reorder(page.id, el.id, "forward")}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <ArrowUp className="size-3.5" />
              </IconButton>
              <IconButton
                label="Bajar una capa"
                size="sm"
                disabled={i === topFirst.length - 1}
                onClick={() => reorder(page.id, el.id, "backward")}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <ArrowDown className="size-3.5" />
              </IconButton>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
        Viñetas <span className="text-zinc-600">· orden de lectura</span>
      </h3>
      {page.panels.length === 0 && <p className="text-xs text-zinc-500">Página libre, sin viñetas.</p>}
      <ul className="flex flex-col gap-0.5">
        {page.panels.map((panel, i) => {
          const isSelected = selection?.kind === "panel" && selection.panelId === panel.id;
          return (
            <li key={panel.id}>
              <button
                type="button"
                onClick={() => select({ kind: "panel", pageId: page.id, panelId: panel.id })}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  isSelected ? "bg-accent-soft text-accent" : "text-zinc-300 hover:bg-surface-3",
                )}
              >
                {panel.image ? <ImageIcon className="size-3.5" /> : <Square className="size-3.5" />}
                Viñeta {i + 1}
                <span className="ml-auto text-[10px] text-zinc-500">{panel.image ? "con imagen" : "vacía"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
