"use client";

import { Expand, Loader2, Star, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { useAssetImage } from "@/lib/hooks/use-asset-image";
import { ASSET_DRAG_MIME } from "@/lib/store/asset-store";
import type { CharacterImage } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  image: CharacterImage;
  isAvatar: boolean;
  onLabelChange: (label: string) => void;
  onPreview: () => void;
  onMakeAvatar: () => void;
  onRemove: () => void;
};

/** Miniatura de una referencia con etiqueta editable y acciones al pasar el ratón. */
export function CharacterImageTile({ image, isAvatar, onLabelChange, onPreview, onMakeAvatar, onRemove }: Props) {
  const el = useAssetImage(image.assetId);

  return (
    <li className="group flex flex-col gap-1.5">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-line bg-surface-0">
        <button
          type="button"
          onClick={onPreview}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(ASSET_DRAG_MIME, image.assetId);
            e.dataTransfer.effectAllowed = "copy";
          }}
          className="workspace-bg flex size-full items-center justify-center"
          aria-label={`Ver ${image.label || "referencia"} en grande`}
        >
          {el ? (
            // eslint-disable-next-line @next/next/no-img-element -- Object URL local
            <img src={el.src} alt={image.label} className="size-full object-contain" draggable={false} />
          ) : (
            <Loader2 className="size-4 animate-spin text-zinc-600" />
          )}
        </button>

        {isAvatar && (
          <span className="absolute top-1.5 left-1.5 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
            Avatar
          </span>
        )}

        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
          <IconButton label="Ver en grande" size="sm" onClick={onPreview} className="size-6 bg-black/70">
            <Expand className="size-3" />
          </IconButton>
          <IconButton
            label={isAvatar ? "Es el avatar" : "Usar como avatar"}
            size="sm"
            onClick={onMakeAvatar}
            isActive={isAvatar}
            className="size-6 bg-black/70"
          >
            <Star className={cn("size-3", isAvatar && "fill-current")} />
          </IconButton>
          <IconButton label="Quitar referencia" size="sm" onClick={onRemove} className="size-6 bg-black/70 hover:text-red-300">
            <Trash2 className="size-3" />
          </IconButton>
        </div>
      </div>

      <input
        type="text"
        value={image.label}
        placeholder="Etiqueta…"
        aria-label="Etiqueta de la referencia"
        onChange={(e) => onLabelChange(e.target.value)}
        className="h-7 w-full rounded-md border border-transparent bg-transparent px-1.5 text-[11px] text-zinc-300 placeholder:text-zinc-600 hover:border-line focus:border-accent focus:outline-none"
      />
    </li>
  );
}
