"use client";

import { useEffect, useRef } from "react";
import { Group, Image as KonvaImage, Line, Transformer } from "react-konva";
import type Konva from "konva";
import { useAssetImage } from "@/lib/hooks/use-asset-image";
import { boundingBox, clamp, imageLayout, toFlat, type Point } from "@/lib/geometry";
import type { PlacedImage } from "@/lib/types";

export type ImagePatch = Partial<Pick<PlacedImage, "offsetX" | "offsetY" | "scale" | "rotation">>;

type Props = {
  placed: PlacedImage;
  poly: Point[];
  uiScale: number;
  onChange: (patch: ImagePatch, coalesceKey: string) => void;
  onExit: () => void;
  onHoverChange: (isHovering: boolean) => void;
};

const ACCENT = "#ff5a36";
const MIN_SCALE = 0.05;
const MAX_SCALE = 20;

/**
 * Modo encuadre: muestra la imagen completa en semitransparente por fuera del
 * marco (lo que queda recortado) y permite arrastrarla, escalarla y rotarla
 * con handles. La viñeta nunca se deforma: solo cambia la PlacedImage.
 */
export function ImageEditOverlay({ placed, poly, uiScale, onChange, onExit, onHoverChange }: Props) {
  const image = useAssetImage(placed.assetId);
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  // Último valor aplicado: los eventos de transform pueden llegar antes del re-render.
  const liveScale = useRef(placed.scale);

  useEffect(() => {
    liveScale.current = placed.scale;
  }, [placed.scale]);

  useEffect(() => {
    const tr = trRef.current;
    const node = groupRef.current;
    if (!tr || !node) return;
    tr.nodes([node]);
    tr.getLayer()?.batchDraw();
  }, [image]);

  if (!image) return null;

  const l = imageLayout(placed, image.naturalWidth, image.naturalHeight, poly);
  const box = boundingBox(poly);
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onChange({ offsetX: node.x() - center.x, offsetY: node.y() - center.y }, "drag");
  };

  const handleTransform = () => {
    const node = groupRef.current;
    if (!node) return;
    // Patrón recomendado por Konva: hornear la escala en el estado y devolver
    // el nodo a escala 1 para que el siguiente evento sea incremental.
    const factor = Math.abs(node.scaleX());
    node.scale({ x: 1, y: 1 });
    const scale = clamp(liveScale.current * factor, MIN_SCALE, MAX_SCALE);
    liveScale.current = scale;
    onChange(
      {
        scale,
        rotation: Math.round(node.rotation() * 10) / 10,
        offsetX: node.x() - center.x,
        offsetY: node.y() - center.y,
      },
      "transform",
    );
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={l.cx}
        y={l.cy}
        rotation={l.rotation}
        draggable
        onDragMove={handleDragMove}
        onTransform={handleTransform}
        onDblClick={onExit}
        onDblTap={onExit}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
      >
        <KonvaImage
          image={image}
          width={l.width}
          height={l.height}
          offsetX={l.width / 2}
          offsetY={l.height / 2}
          scaleX={l.flipX ? -1 : 1}
          opacity={0.32}
        />
      </Group>

      {/* El marco de la viñeta, siempre visible encima de la imagen fantasma. */}
      <Line points={toFlat(poly)} closed stroke={ACCENT} strokeWidth={2.5 * uiScale} listening={false} />

      <Transformer
        ref={trRef}
        keepRatio
        flipEnabled={false}
        enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
        rotateEnabled
        rotationSnaps={[0, 90, 180, 270]}
        rotationSnapTolerance={3}
        rotateAnchorOffset={28}
        anchorSize={10}
        anchorCornerRadius={2}
        anchorStroke={ACCENT}
        anchorFill="#ffffff"
        borderStroke={ACCENT}
        borderDash={[4, 4]}
        boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 24 || Math.abs(newBox.height) < 24 ? oldBox : newBox)}
      />
    </>
  );
}
