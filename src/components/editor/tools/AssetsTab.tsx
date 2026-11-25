"use client";

import { useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { useAssetImage } from "@/lib/hooks/use-asset-image";
import { ACCEPT_ATTR, ASSET_DRAG_MIME, useAssetStore } from "@/lib/store/asset-store";
import { useEditorStore } from "@/lib/store/editor-store";
import type { AssetMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

type ThumbProps = {
  asset: AssetMeta;
  usage: number;
  canPlace: boolean;
  onPlace: (assetId: string) => void;
  onRemove: (assetId: string) => void;
};

function AssetThumb({ asset, usage, canPlace, onPlace, onRemove }: ThumbProps) {
  const image = useAssetImage(asset.id);

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(ASSET_DRAG_MIME, asset.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <li className="group relative">
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={() => canPlace && onPlace(asset.id)}
        title={canPlace ? `Colocar "${asset.name}" en la viñeta seleccionada` : `${asset.name} — arrástrala a una viñeta`}
        className={cn(
          "relative block aspect-square w-full cursor-grab overflow-hidden rounded-lg border border-line bg-surface-2 transition-colors active:cursor-grabbing",
          canPlace ? "hover:border-accent" : "hover:border-line-strong",
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Object URL local, next/image no aplica
          <img src={image.src} alt={asset.name} className="size-full object-cover" draggable={false} />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Loader2 className="size-4 animate-spin text-zinc-600" />
          </span>
        )}
        {usage > 0 && (
          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-zinc-200 tabular-nums">
            ×{usage}
          </span>
        )}
      </button>
      <IconButton
        label={usage > 0 ? `En uso en ${usage} viñeta(s): quítala de las viñetas para borrarla` : "Eliminar imagen"}
        size="sm"
        disabled={usage > 0}
        onClick={() => onRemove(asset.id)}
        className="absolute top-1 right-1 size-6 bg-black/70 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-300"
      >
        <Trash2 className="size-3" />
      </IconButton>
    </li>
  );
}

export function AssetsTab() {
  const assets = useAssetStore((s) => s.assets);
  const importingCount = useAssetStore((s) => s.importingCount);
  const lastError = useAssetStore((s) => s.lastError);
  const importFiles = useAssetStore((s) => s.importFiles);
  const removeAsset = useAssetStore((s) => s.remove);
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);
  const setPanelImage = useEditorStore((s) => s.setPanelImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  // Cuántas viñetas del capítulo usan cada imagen (para no borrar una en uso).
  const usage = useMemo(() => {
    const map = new Map<string, number>();
    project?.pages.forEach((pg) =>
      pg.panels.forEach((pn) => pn.image && map.set(pn.image.assetId, (map.get(pn.image.assetId) ?? 0) + 1)),
    );
    return map;
  }, [project?.pages]);

  const selectedPanel = selection?.kind === "panel" ? selection : null;

  const handleFiles = (files: FileList | null) => {
    if (files?.length) void importFiles(Array.from(files));
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
            isOver ? "border-accent bg-accent-soft" : "border-line-strong hover:border-zinc-500",
          )}
        >
          {importingCount > 0 ? (
            <Loader2 className="size-5 animate-spin text-accent" />
          ) : (
            <ImagePlus className={cn("size-5", isOver ? "text-accent" : "text-zinc-400")} />
          )}
          <span className="text-xs font-medium text-zinc-200">
            {importingCount > 0 ? `Importando ${importingCount}…` : "Suelta imágenes o haz clic"}
          </span>
          <span className="text-[11px] text-zinc-500">PNG, JPG o WEBP · se guardan en este navegador</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {lastError && <p className="text-xs text-red-300">{lastError}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
          Biblioteca <span className="text-zinc-600 tabular-nums">· {assets.length}</span>
        </h3>
      </div>

      {assets.length === 0 ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          También puedes arrastrar archivos directamente sobre una viñeta del lienzo.
        </p>
      ) : (
        <>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            {selectedPanel
              ? "Haz clic en una imagen para colocarla en la viñeta seleccionada."
              : "Arrastra una imagen a una viñeta, o selecciona una viñeta y haz clic aquí."}
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {assets.map((a) => (
              <AssetThumb
                key={a.id}
                asset={a}
                usage={usage.get(a.id) ?? 0}
                canPlace={!!selectedPanel}
                onPlace={(id) => selectedPanel && setPanelImage(selectedPanel.pageId, selectedPanel.panelId, id)}
                onRemove={(id) => void removeAsset(id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
