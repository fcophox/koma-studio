"use client";

import { Group, Image as KonvaImage } from "react-konva";
import { useAssetImage } from "@/lib/hooks/use-asset-image";
import { imageLayout, type Point } from "@/lib/geometry";
import type { PlacedImage } from "@/lib/types";

type Props = {
  placed: PlacedImage;
  poly: Point[];
  opacity?: number;
};

/**
 * Imagen de una viñeta. Se dibuja dentro del grupo recortado por el polígono,
 * así que nunca sale del marco. El flip se aplica sobre su propio centro.
 */
export function PanelImage({ placed, poly, opacity = 1 }: Props) {
  const image = useAssetImage(placed.assetId);
  if (!image) return null;
  const l = imageLayout(placed, image.naturalWidth, image.naturalHeight, poly);

  return (
    <Group x={l.cx} y={l.cy} rotation={l.rotation} listening={false}>
      <KonvaImage
        image={image}
        width={l.width}
        height={l.height}
        offsetX={l.width / 2}
        offsetY={l.height / 2}
        scaleX={l.flipX ? -1 : 1}
        opacity={opacity}
      />
    </Group>
  );
}
