"use client";

import { useState } from "react";
import { ChevronRight, Plus, Users } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { CHARACTER_CATEGORIES, CHARACTER_COLORS } from "@/lib/characters";
import { createCharacter } from "@/lib/factory";
import { useAssetImage } from "@/lib/hooks/use-asset-image";
import { ASSET_DRAG_MIME } from "@/lib/store/asset-store";
import { useEditorStore } from "@/lib/store/editor-store";
import type { Character, CharacterImage } from "@/lib/types";
import { CharacterAvatar } from "../characters/CharacterAvatar";
import { CharacterSheetDialog } from "../characters/CharacterSheetDialog";

/** Miniatura arrastrable: suéltala en una viñeta para usar la referencia como imagen. */
function RefThumb({ image }: { image: CharacterImage }) {
  const el = useAssetImage(image.assetId);
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ASSET_DRAG_MIME, image.assetId);
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={`${image.label || "Referencia"} — arrástrala a una viñeta`}
      className="size-10 shrink-0 cursor-grab overflow-hidden rounded-md border border-line bg-surface-0 active:cursor-grabbing"
    >
      {el && (
        // eslint-disable-next-line @next/next/no-img-element -- Object URL local
        <img src={el.src} alt={image.label} className="size-full object-cover object-top" draggable={false} />
      )}
    </li>
  );
}

function CharacterCard({ character, onOpen }: { character: Character; onOpen: () => void }) {
  const counts = CHARACTER_CATEGORIES.map((c) => ({
    ...c,
    n: character.images.filter((i) => i.category === c.id).length,
  })).filter((c) => c.n > 0);
  const strip = character.images.slice(0, 5);
  const extra = character.images.length - strip.length;

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-surface-2/50">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-3"
        style={{ boxShadow: `inset 3px 0 0 ${character.color}` }}
      >
        <CharacterAvatar character={character} className="size-11 rounded-full text-sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-100">{character.name || "Sin nombre"}</span>
          <span className="block truncate text-[11px] text-zinc-500">
            {character.role || "Sin rol"}
            {counts.length > 0 && ` · ${counts.map((c) => `${c.n} ${c.label.toLowerCase()}`).join(", ")}`}
          </span>
        </span>
        <ChevronRight className="size-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300" />
      </button>

      {character.description && (
        <p className="line-clamp-2 px-3 pb-2 text-[11px] leading-relaxed text-zinc-400">{character.description}</p>
      )}

      {strip.length > 0 && (
        <ul className="flex gap-1.5 px-3 pb-3">
          {strip.map((img) => (
            <RefThumb key={img.id} image={img} />
          ))}
          {extra > 0 && (
            <li className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-3 text-[11px] text-zinc-400 tabular-nums">
              +{extra}
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

const NO_CHARACTERS: Character[] = [];

export function CharactersTab() {
  // Referencia estable: un [] nuevo en cada lectura haría re-renderizar sin fin.
  const characters = useEditorStore((s) => s.project?.characters ?? NO_CHARACTERS);
  const addCharacter = useEditorStore((s) => s.addCharacter);
  const [openId, setOpenId] = useState<string | null>(null);

  const handleCreate = () => {
    const color = CHARACTER_COLORS[characters.length % CHARACTER_COLORS.length];
    const ch = createCharacter("Nuevo personaje", color);
    addCharacter(ch);
    setOpenId(ch.id);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
          Personajes <span className="text-zinc-600 tabular-nums">· {characters.length}</span>
        </h3>
        <IconButton label="Nuevo personaje" size="sm" onClick={handleCreate}>
          <Plus className="size-4" />
        </IconButton>
      </div>

      {characters.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Users className="size-5" />
          </span>
          <p className="text-xs leading-relaxed text-zinc-400">
            Crea fichas con la descripción de cada personaje y sus referencias de cuerpo, rostro, ropa y variantes.
          </p>
          <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={handleCreate}>
            Crear personaje
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {characters.map((ch) => (
              <CharacterCard key={ch.id} character={ch} onOpen={() => setOpenId(ch.id)} />
            ))}
          </ul>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Arrastra una miniatura a una viñeta para usarla como imagen de referencia.
          </p>
        </>
      )}

      <CharacterSheetDialog characterId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
