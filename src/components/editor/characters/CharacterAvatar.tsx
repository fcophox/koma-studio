"use client";

import { characterAvatar } from "@/lib/characters";
import { useAssetImage } from "@/lib/hooks/use-asset-image";
import type { Character } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  character: Character;
  className?: string;
};

/** Avatar del personaje (imagen elegida o primer rostro) o sus iniciales. */
export function CharacterAvatar({ character, className }: Props) {
  const image = useAssetImage(characterAvatar(character));
  const initials =
    character.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  return (
    <span
      className={cn("relative flex shrink-0 items-center justify-center overflow-hidden font-semibold text-white", className)}
      style={{ backgroundColor: character.color }}
      aria-hidden
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Object URL local
        <img src={image.src} alt="" className="size-full object-cover object-top" draggable={false} />
      ) : (
        initials
      )}
    </span>
  );
}
