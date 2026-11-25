"use client";

import { useState, type CSSProperties } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ColorRow, SliderRow, TextInput, Toggle } from "@/components/ui/Fields";
import { ELEMENT_DRAG_MIME, type ElementDragPayload } from "@/lib/canvas-bridge";
import { createCustomSfx, createSfx } from "@/lib/factory";
import { getFormat } from "@/lib/formats";
import { resolveFont } from "@/lib/fonts";
import { insertionPoint } from "@/lib/insert";
import { SFX_CATEGORIES, SFX_PRESETS, type SfxPreset } from "@/lib/sfx-catalog";
import { selectActivePage, useEditorStore } from "@/lib/store/editor-store";
import type { OnomatopoeiaElement } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ElementActions, FontSelect, FontStyleToggles, InspectorSection } from "./ElementActions";

type Category = SfxPreset["category"];
const CATEGORY_IDS = Object.keys(SFX_CATEGORIES) as Category[];
const SHORT_LABEL: Record<Category, string> = {
  impact: "Acción",
  speed: "Velocidad",
  emotion: "Emoción",
  effects: "Efectos",
};

/** Vista previa HTML con el mismo estilo que tendrá en el lienzo. */
function sfxPreviewStyle(p: {
  fontFamily: string;
  fontStyle: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  skewX: number;
  rotation: number;
  fontSize: number;
}): CSSProperties {
  const scale = 26 / p.fontSize;
  return {
    fontFamily: resolveFont(p.fontFamily),
    fontWeight: p.fontStyle.includes("bold") ? 700 : 400,
    fontStyle: p.fontStyle.includes("italic") ? "italic" : "normal",
    fontSize: 26,
    color: p.fill,
    WebkitTextStroke: `${Math.max(2, p.strokeWidth * scale * 1.2)}px ${p.stroke}`,
    paintOrder: "stroke fill",
    transform: `rotate(${p.rotation * 0.6}deg) skewX(${(-Math.atan(p.skewX) * 180) / Math.PI}deg)`,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
}

function SfxInspector({ pageId, sfx }: { pageId: string; sfx: OnomatopoeiaElement }) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const setEditingText = useEditorStore((s) => s.setEditingText);
  const update = (patch: Partial<OnomatopoeiaElement>, key?: string) => updateElement(pageId, sfx.id, patch, key);

  return (
    <>
      <InspectorSection title="Onomatopeya seleccionada">
        <div className="flex gap-2">
          <TextInput
            aria-label="Texto de la onomatopeya"
            value={sfx.text}
            onChange={(e) => update({ text: e.target.value })}
            className="h-8"
            style={{ fontFamily: resolveFont(sfx.fontFamily) }}
          />
          <Button size="sm" onClick={() => setEditingText(sfx.id)}>
            En lienzo
          </Button>
        </div>
        <ElementActions pageId={pageId} elementId={sfx.id} />
      </InspectorSection>

      <InspectorSection title="Tipografía">
        <div className="flex gap-2">
          <FontSelect value={sfx.fontFamily} onChange={(v) => update({ fontFamily: v })} />
          <FontStyleToggles value={sfx.fontStyle} onChange={(v) => update({ fontStyle: v })} />
        </div>
        <SliderRow label="Tamaño" value={sfx.fontSize} min={20} max={320} unit="px" onChange={(v) => update({ fontSize: v })} />
        <SliderRow
          label="Espaciado"
          value={sfx.letterSpacing}
          min={-10}
          max={40}
          unit="px"
          onChange={(v) => update({ letterSpacing: v })}
        />
        <Toggle label="Vertical (estilo japonés)" isChecked={sfx.vertical} onChange={(v) => update({ vertical: v })} />
      </InspectorSection>

      <InspectorSection title="Color">
        <ColorRow label="Relleno" value={sfx.fill} onChange={(v) => update({ fill: v })} />
        <ColorRow label="Contorno" value={sfx.stroke} onChange={(v) => update({ stroke: v })} />
        <SliderRow
          label="Grosor del contorno"
          value={sfx.strokeWidth}
          min={0}
          max={30}
          step={0.5}
          unit="px"
          onChange={(v) => update({ strokeWidth: v })}
        />
      </InspectorSection>

      <InspectorSection title="Transformación">
        <SliderRow
          label="Escala"
          value={Math.round(sfx.scaleX * 100)}
          min={20}
          max={400}
          unit="%"
          onChange={(v) => update({ scaleX: v / 100, scaleY: v / 100 })}
        />
        <SliderRow
          label="Rotación"
          value={Math.round(sfx.rotation)}
          min={-180}
          max={180}
          unit="°"
          onChange={(v) => update({ rotation: v })}
        />
        <SliderRow
          label="Inclinación"
          value={Math.round(sfx.skewX * 100)}
          min={-80}
          max={80}
          unit="%"
          onChange={(v) => update({ skewX: v / 100 })}
        />
      </InspectorSection>
    </>
  );
}

export function SfxTab() {
  const project = useEditorStore((s) => s.project);
  const page = useEditorStore(selectActivePage);
  const selection = useEditorStore((s) => s.selection);
  const addElement = useEditorStore((s) => s.addElement);
  const [category, setCategory] = useState<Category>("impact");
  const [customText, setCustomText] = useState("");

  if (!project || !page) return null;
  const selected =
    selection?.kind === "element" ? page.elements.find((el) => el.id === selection.elementId) : undefined;
  const selectedSfx = selected?.type === "sfx" ? selected : undefined;

  const point = () => insertionPoint(getFormat(project.formatId), page.elements.length);

  const handleAddPreset = (preset: SfxPreset) => {
    const pt = point();
    addElement(page.id, createSfx(preset, pt.x, pt.y));
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const text = customText.trim();
    if (!text) return;
    const pt = point();
    // Reutiliza el estilo de la onomatopeya seleccionada, si la hay.
    addElement(page.id, createCustomSfx(text, pt.x, pt.y, selectedSfx));
    setCustomText("");
  };

  const presets = SFX_PRESETS.filter((p) => p.category === category);

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
        <div role="tablist" aria-label="Categorías" className="grid grid-cols-4 gap-1 rounded-lg bg-surface-2 p-0.5">
          {CATEGORY_IDS.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              title={SFX_CATEGORIES[c]}
              onClick={() => setCategory(c)}
              className={cn(
                "h-7 rounded-md text-[11px] font-medium transition-colors",
                category === c ? "bg-surface-3 text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {SHORT_LABEL[c]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              draggable
              onDragStart={(e) => {
                const payload: ElementDragPayload = { kind: "sfx", presetId: p.id };
                e.dataTransfer.setData(ELEMENT_DRAG_MIME, JSON.stringify(payload));
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => handleAddPreset(p)}
              title={p.hint ?? p.text}
              className="workspace-bg flex h-16 cursor-grab items-center justify-center overflow-hidden rounded-lg border border-line px-2 transition-colors hover:border-accent active:cursor-grabbing"
            >
              <span
                style={sfxPreviewStyle({
                  fontFamily: p.fontId,
                  fontStyle: p.fontStyle ?? "normal",
                  fill: p.fill,
                  stroke: p.stroke,
                  strokeWidth: p.strokeWidth,
                  skewX: p.skewX,
                  rotation: p.rotation,
                  fontSize: p.fontSize,
                })}
              >
                {p.text}
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={handleAddCustom} className="flex flex-col gap-1.5">
          <label htmlFor="custom-sfx" className="text-[11px] text-zinc-500">
            Crear onomatopeya {selectedSfx ? "con el estilo de la seleccionada" : "personalizada"}
          </label>
          <div className="flex gap-2">
            <TextInput
              id="custom-sfx"
              value={customText}
              placeholder="KRAKOOM!"
              onChange={(e) => setCustomText(e.target.value)}
              className="h-8"
            />
            <Button type="submit" size="sm" variant="primary" icon={<Plus className="size-3.5" />} disabled={!customText.trim()}>
              Añadir
            </Button>
          </div>
        </form>
      </section>

      {selectedSfx && <SfxInspector key={selectedSfx.id} pageId={page.id} sfx={selectedSfx} />}
    </div>
  );
}
