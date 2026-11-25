"use client";

import { AlignCenter, AlignLeft, AlignRight, ScanText } from "lucide-react";
import { BubbleGlyph } from "@/components/shared/ElementSvg";
import { Button } from "@/components/ui/Button";
import { ColorRow, NumberInput, Segmented, SliderRow, Toggle } from "@/components/ui/Fields";
import { bubbleTextBox, tailPreset } from "@/lib/bubbles";
import { ELEMENT_DRAG_MIME, type ElementDragPayload } from "@/lib/canvas-bridge";
import { createBubble } from "@/lib/factory";
import { getFormat } from "@/lib/formats";
import { resolveFont } from "@/lib/fonts";
import { insertionPoint } from "@/lib/insert";
import { selectActivePage, useEditorStore } from "@/lib/store/editor-store";
import type { BubbleKind, SpeechBubble } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ElementActions, FontSelect, FontStyleToggles, InspectorSection } from "./ElementActions";

const KINDS: Array<{ kind: BubbleKind; label: string }> = [
  { kind: "oval", label: "Ovalado" },
  { kind: "thought", label: "Pensamiento" },
  { kind: "shout", label: "Grito" },
  { kind: "whisper", label: "Susurro" },
  { kind: "narration", label: "Narración" },
];

function BubbleInspector({ pageId, bubble }: { pageId: string; bubble: SpeechBubble }) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const setEditingText = useEditorStore((s) => s.setEditingText);
  const update = (patch: Partial<SpeechBubble>, key?: string | null) => updateElement(pageId, bubble.id, patch, key);

  const handleFitToText = async () => {
    // Konva solo se carga en cliente: import diferido para no romper el SSR.
    const { measureText } = await import("@/lib/text-measure");
    const box = bubbleTextBox(bubble.kind, bubble.width, bubble.height);
    const { height } = measureText({
      text: bubble.text,
      fontFamily: resolveFont(bubble.fontFamily),
      fontSize: bubble.fontSize,
      fontStyle: bubble.fontStyle,
      lineHeight: bubble.lineHeight,
      width: box.width,
    });
    const ratio = box.height / bubble.height;
    const newHeight = Math.max(40, Math.ceil(height / ratio + bubble.fontSize * 0.4));
    const k = newHeight / bubble.height;
    update(
      { height: newHeight, tail: { ...bubble.tail, tipY: bubble.tail.tipY * k } },
      null,
    );
  };

  const setTail = (side: "left" | "bottom" | "right" | "none") =>
    update(
      side === "none"
        ? { tail: { ...bubble.tail, enabled: false } }
        : { tail: { enabled: true, ...tailPreset(side, bubble.width, bubble.height) } },
      null,
    );

  return (
    <>
      <InspectorSection title="Globo seleccionado">
        <div className="grid grid-cols-5 gap-1">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              title={k.label}
              aria-pressed={bubble.kind === k.kind}
              onClick={() => update({ kind: k.kind }, null)}
              className={cn(
                "rounded-md p-1 transition-colors",
                bubble.kind === k.kind ? "bg-accent-soft ring-1 ring-accent" : "bg-surface-2 hover:bg-surface-3",
              )}
            >
              <BubbleGlyph kind={k.kind} className="h-7 w-full" />
            </button>
          ))}
        </div>
        <textarea
          aria-label="Texto del globo"
          value={bubble.text}
          rows={3}
          onChange={(e) => update({ text: e.target.value })}
          className="w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm leading-snug focus:border-accent focus:outline-none"
          style={{ fontFamily: resolveFont(bubble.fontFamily) }}
        />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => setEditingText(bubble.id)}>
            Editar en el lienzo
          </Button>
          <Button size="sm" icon={<ScanText className="size-3.5" />} onClick={handleFitToText} title="Ajusta el alto al texto">
            Ajustar
          </Button>
        </div>
        <ElementActions pageId={pageId} elementId={bubble.id} />
      </InspectorSection>

      <InspectorSection title="Texto">
        <div className="flex gap-2">
          <FontSelect value={bubble.fontFamily} onChange={(v) => update({ fontFamily: v })} />
          <FontStyleToggles value={bubble.fontStyle} onChange={(v) => update({ fontStyle: v })} />
        </div>
        <SliderRow label="Tamaño" value={bubble.fontSize} min={10} max={80} unit="px" onChange={(v) => update({ fontSize: v })} />
        <SliderRow
          label="Interlineado"
          value={bubble.lineHeight}
          min={0.8}
          max={2}
          step={0.05}
          onChange={(v) => update({ lineHeight: v })}
        />
        <Segmented<SpeechBubble["align"]>
          value={bubble.align}
          onChange={(v) => update({ align: v })}
          options={[
            { value: "left", label: <AlignLeft className="size-3.5" />, title: "Izquierda" },
            { value: "center", label: <AlignCenter className="size-3.5" />, title: "Centro" },
            { value: "right", label: <AlignRight className="size-3.5" />, title: "Derecha" },
          ]}
        />
        <ColorRow label="Color del texto" value={bubble.textColor} onChange={(v) => update({ textColor: v })} />
      </InspectorSection>

      <InspectorSection title="Cola">
        <Toggle
          label="Mostrar cola"
          isChecked={bubble.tail.enabled}
          onChange={(v) => update({ tail: { ...bubble.tail, enabled: v } }, null)}
        />
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              ["left", "Izq."],
              ["bottom", "Abajo"],
              ["right", "Der."],
              ["none", "Sin"],
            ] as const
          ).map(([side, label]) => (
            <Button key={side} size="sm" onClick={() => setTail(side)} className="px-0">
              {label}
            </Button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Arrastra el punto naranja del lienzo hacia el personaje que habla.
        </p>
      </InspectorSection>

      <InspectorSection title="Forma">
        <ColorRow label="Relleno" value={bubble.fill} onChange={(v) => update({ fill: v })} />
        <ColorRow label="Borde" value={bubble.stroke} onChange={(v) => update({ stroke: v })} />
        <SliderRow
          label="Grosor del borde"
          value={bubble.strokeWidth}
          min={0}
          max={10}
          step={0.5}
          unit="px"
          onChange={(v) => update({ strokeWidth: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
            Ancho
            <NumberInput
              min={40}
              value={Math.round(bubble.width)}
              onChange={(v) => update({ width: Math.max(40, v) })}
              className="h-8"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-zinc-500">
            Alto
            <NumberInput
              min={30}
              value={Math.round(bubble.height)}
              onChange={(v) => update({ height: Math.max(30, v) })}
              className="h-8"
            />
          </label>
        </div>
        <SliderRow
          label="Rotación"
          value={Math.round(bubble.rotation)}
          min={-180}
          max={180}
          unit="°"
          onChange={(v) => update({ rotation: v })}
        />
      </InspectorSection>
    </>
  );
}

export function BubblesTab() {
  const project = useEditorStore((s) => s.project);
  const page = useEditorStore(selectActivePage);
  const selection = useEditorStore((s) => s.selection);
  const addElement = useEditorStore((s) => s.addElement);

  if (!project || !page) return null;
  const selected =
    selection?.kind === "element" ? page.elements.find((el) => el.id === selection.elementId) : undefined;

  const handleAdd = (kind: BubbleKind) => {
    const pt = insertionPoint(getFormat(project.formatId), page.elements.length);
    addElement(page.id, createBubble(kind, pt.x, pt.y));
  };

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
        <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Catálogo</h3>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              draggable
              onDragStart={(e) => {
                const payload: ElementDragPayload = { kind: "bubble", bubbleKind: k.kind };
                e.dataTransfer.setData(ELEMENT_DRAG_MIME, JSON.stringify(payload));
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => handleAdd(k.kind)}
              title={`Añadir globo ${k.label.toLowerCase()} (o arrástralo a la página)`}
              className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-line bg-surface-2 px-1 pt-2 pb-1.5 transition-colors hover:border-accent active:cursor-grabbing"
            >
              <BubbleGlyph kind={k.kind} className="h-11 w-full" />
              <span className="text-[10px] text-zinc-400">{k.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">Haz clic para añadirlo al centro de la vista o arrástralo a la página.</p>
      </section>

      {selected?.type === "bubble" && <BubbleInspector key={selected.id} pageId={page.id} bubble={selected} />}
    </div>
  );
}
