"use client";

import { useRef } from "react";
import {
  ClipboardPaste,
  Copy,
  Crop,
  FlipHorizontal2,
  ImageOff,
  ImagePlus,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SliderRow } from "@/components/ui/Fields";
import { useAssetImage } from "@/lib/hooks/use-asset-image";
import { containScale, panelPolygon } from "@/lib/geometry";
import { copySelectionFromButton, pasteClipboard } from "@/lib/clipboard";
import { ACCEPT_ATTR, useAssetStore } from "@/lib/store/asset-store";
import { useEditorStore } from "@/lib/store/editor-store";
import type { Page, PageFormat, PanelSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  page: Page;
  panel: PanelSlot;
  index: number;
  format: PageFormat;
};

/** Propiedades de la viñeta seleccionada y de su imagen. */
export function PanelInspector({ page, panel, index, format }: Props) {
  const editingPanelId = useEditorStore((s) => s.editingPanelId);
  const setEditingPanel = useEditorStore((s) => s.setEditingPanel);
  const setPanelImage = useEditorStore((s) => s.setPanelImage);
  const updatePanelImage = useEditorStore((s) => s.updatePanelImage);
  const importFiles = useAssetStore((s) => s.importFiles);
  const assetMeta = useAssetStore((s) => s.assets.find((a) => a.id === panel.image?.assetId));
  const image = useAssetImage(panel.image?.assetId);
  const hasClipboard = useEditorStore((s) => s.clipboard?.kind === "panel");
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const [added] = await importFiles(files);
    if (added) setPanelImage(page.id, panel.id, added.id);
  };

  const fileInput = (
    <input ref={inputRef} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={handlePick} />
  );

  if (!panel.image) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-zinc-400">
          Viñeta {index + 1} vacía. Arrastra una imagen desde tu equipo o desde la pestaña Imágenes, o haz doble clic en
          ella.
        </p>
        {hasClipboard && (
          <Button
            size="sm"
            variant="primary"
            icon={<ClipboardPaste className="size-3.5" />}
            onClick={() => pasteClipboard()}
          >
            Pegar imagen copiada (⌘V)
          </Button>
        )}
        <Button size="sm" icon={<ImagePlus className="size-3.5" />} onClick={() => inputRef.current?.click()}>
          Elegir archivo…
        </Button>
        {fileInput}
      </div>
    );
  }

  const placed = panel.image;
  const isEditing = editingPanelId === panel.id;
  const update = (patch: Parameters<typeof updatePanelImage>[2], key?: string | null) =>
    updatePanelImage(page.id, panel.id, patch, key);

  const handleFit = (mode: "cover" | "contain") => {
    const scale =
      mode === "cover" || !image
        ? 1
        : containScale(image.naturalWidth, image.naturalHeight, panelPolygon(panel, format, page.style, page.bleed));
    update({ scale, offsetX: 0, offsetY: 0, rotation: 0 }, `image:${panel.id}:fit-${mode}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="size-12 shrink-0 overflow-hidden rounded-md border border-line bg-surface-2">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- Object URL local
            <img
              src={image.src}
              alt=""
              className={cn("size-full object-cover", placed.flipX && "-scale-x-100")}
              draggable={false}
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-zinc-200">{assetMeta?.name ?? "Imagen"}</p>
          {assetMeta && (
            <p className="text-[11px] text-zinc-500 tabular-nums">
              {assetMeta.width} × {assetMeta.height} px
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => copySelectionFromButton("copy")} title="⌘C">
          Copiar
        </Button>
        <Button size="sm" icon={<Scissors className="size-3.5" />} onClick={() => copySelectionFromButton("cut")} title="⌘X">
          Cortar
        </Button>
        <Button
          size="sm"
          icon={<ClipboardPaste className="size-3.5" />}
          onClick={() => pasteClipboard()}
          disabled={!hasClipboard}
          title="Reemplaza la imagen (⌘V)"
        >
          Pegar
        </Button>
      </div>

      <Button
        size="sm"
        variant={isEditing ? "primary" : "secondary"}
        icon={<Crop className="size-3.5" />}
        onClick={() => setEditingPanel(isEditing ? null : panel.id)}
      >
        {isEditing ? "Terminar encuadre (Esc)" : "Editar encuadre (doble clic / Enter)"}
      </Button>

      <SliderRow
        label="Zoom"
        value={Math.round(placed.scale * 100)}
        min={10}
        max={400}
        unit="%"
        onChange={(v) => update({ scale: v / 100 })}
      />
      <SliderRow
        label="Rotación"
        value={placed.rotation}
        min={-180}
        max={180}
        step={0.5}
        unit="°"
        onChange={(v) => update({ rotation: v })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={placed.flipX ? "primary" : "secondary"}
          aria-pressed={placed.flipX}
          icon={<FlipHorizontal2 className="size-3.5" />}
          onClick={() => update({ flipX: !placed.flipX }, null)}
        >
          Voltear
        </Button>
        <Button
          size="sm"
          icon={<RotateCcw className="size-3.5" />}
          disabled={placed.rotation === 0}
          onClick={() => update({ rotation: 0 }, `image:${panel.id}:rot-reset`)}
        >
          Rotación 0°
        </Button>
        <Button size="sm" icon={<Maximize2 className="size-3.5" />} onClick={() => handleFit("cover")}>
          Rellenar
        </Button>
        <Button size="sm" icon={<Minimize2 className="size-3.5" />} onClick={() => handleFit("contain")}>
          Ajustar
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          icon={<ImagePlus className="size-3.5" />}
          onClick={() => inputRef.current?.click()}
        >
          Reemplazar
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="flex-1"
          icon={<ImageOff className="size-3.5" />}
          onClick={() => setPanelImage(page.id, panel.id, null)}
        >
          Quitar
        </Button>
      </div>
      {fileInput}
    </div>
  );
}
