"use client";

import type { ReactNode } from "react";
import { CopyCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ColorRow, NumberInput, Segmented, SliderRow, Toggle } from "@/components/ui/Fields";
import { getFormat } from "@/lib/formats";
import { selectActivePage, selectActivePageIndex, useEditorStore } from "@/lib/store/editor-store";
import { getTemplate } from "@/lib/templates";
import { formatPageNumber } from "@/lib/utils";
import { TemplateGrid } from "../TemplateGrid";
import { PanelInspector } from "./PanelInspector";

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function PageTab() {
  const project = useEditorStore((s) => s.project);
  const page = useEditorStore(selectActivePage);
  const pageIndex = useEditorStore(selectActivePageIndex);
  const selection = useEditorStore((s) => s.selection);
  const applyTemplate = useEditorStore((s) => s.applyTemplate);
  const setPageStyle = useEditorStore((s) => s.setPageStyle);
  const applyStyleToAllPages = useEditorStore((s) => s.applyStyleToAllPages);
  const setNumbering = useEditorStore((s) => s.setNumbering);

  if (!project || !page) return null;

  const format = getFormat(project.formatId);
  const { style } = page;
  const { numbering } = project;
  const selectedPanelIndex =
    selection?.kind === "panel" ? page.panels.findIndex((p) => p.id === selection.panelId) : -1;

  return (
    <div className="flex flex-col">
      {selectedPanelIndex >= 0 && (
        <Section title={`Viñeta ${selectedPanelIndex + 1}`}>
          <PanelInspector
            key={page.panels[selectedPanelIndex].id}
            page={page}
            panel={page.panels[selectedPanelIndex]}
            index={selectedPanelIndex}
            format={format}
          />
        </Section>
      )}

      <Section
        title="Plantilla"
        aside={
          <span className="text-[11px] text-zinc-400">
            Pág. {formatPageNumber(numbering.startAt + pageIndex)} · {getTemplate(page.templateId).name}
          </span>
        }
      >
        <TemplateGrid
          format={format}
          style={style}
          direction={project.readingDirection}
          selectedId={page.templateId}
          onPick={(id) => applyTemplate(page.id, id)}
        />
      </Section>

      <Section title="Viñetas y página">
        <SliderRow
          label="Grosor del borde"
          value={style.borderWidth}
          min={0}
          max={20}
          unit="px"
          onChange={(v) => setPageStyle(page.id, { borderWidth: v })}
        />
        <SliderRow
          label="Separación (gutter)"
          value={style.gutter}
          min={0}
          max={80}
          unit="px"
          onChange={(v) => setPageStyle(page.id, { gutter: v })}
        />
        <SliderRow
          label="Margen exterior"
          value={style.margin}
          min={0}
          max={160}
          unit="px"
          onChange={(v) => setPageStyle(page.id, { margin: v })}
        />
        <ColorRow label="Color del borde" value={style.borderColor} onChange={(v) => setPageStyle(page.id, { borderColor: v })} />
        <ColorRow
          label="Fondo de página"
          value={style.pageBackground}
          onChange={(v) => setPageStyle(page.id, { pageBackground: v })}
        />
        <ColorRow label="Relleno de viñeta" value={style.panelFill} onChange={(v) => setPageStyle(page.id, { panelFill: v })} />
        <Button
          size="sm"
          variant="secondary"
          icon={<CopyCheck className="size-3.5" />}
          onClick={() => applyStyleToAllPages(page.id)}
        >
          Aplicar a todas las páginas
        </Button>
      </Section>

      <Section title="Numeración del capítulo">
        <Toggle label="Mostrar número impreso" isChecked={numbering.show} onChange={(v) => setNumbering({ show: v })} />
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="numbering-start" className="text-xs text-zinc-400">
            Empezar en
          </label>
          <NumberInput
            id="numbering-start"
            min={0}
            value={numbering.startAt}
            onChange={(v) => setNumbering({ startAt: Math.max(0, Math.round(v)) })}
            className="h-8 w-20"
          />
        </div>
        <Segmented<"center" | "outer">
          value={numbering.position}
          onChange={(v) => setNumbering({ position: v })}
          options={[
            { value: "center", label: "Centrado" },
            { value: "outer", label: "Borde exterior" },
          ]}
        />
        <SliderRow
          label="Tamaño"
          value={numbering.fontSize}
          min={10}
          max={48}
          unit="px"
          onChange={(v) => setNumbering({ fontSize: v })}
        />
        <ColorRow label="Color" value={numbering.color} onChange={(v) => setNumbering({ color: v })} />
      </Section>
    </div>
  );
}
