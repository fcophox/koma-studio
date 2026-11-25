"use client";

import { Group, Shape, Text } from "react-konva";
import type Konva from "konva";
import { bubbleGeometry, bubbleTextBox } from "@/lib/bubbles";
import { resolveFont } from "@/lib/fonts";
import { measureText, verticalize } from "@/lib/text-measure";
import type { OnomatopoeiaElement, SpeechBubble } from "@/lib/types";

export type NodeHandlers = {
  isDraggable: boolean;
  isTextHidden: boolean;
  nodeRef: (node: Konva.Group | null) => void;
  onSelect: () => void;
  onDragMove: (x: number, y: number) => void;
  onDblClick: () => void;
  onHoverChange: (isHovering: boolean) => void;
};

function groupProps(el: SpeechBubble | OnomatopoeiaElement, h: NodeHandlers) {
  return {
    ref: h.nodeRef,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    scaleX: el.scaleX,
    scaleY: el.scaleY,
    draggable: h.isDraggable && !el.locked,
    onMouseDown: h.onSelect,
    onTouchStart: h.onSelect,
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => h.onDragMove(e.target.x(), e.target.y()),
    onDblClick: h.onDblClick,
    onDblTap: h.onDblClick,
    onMouseEnter: () => h.onHoverChange(true),
    onMouseLeave: () => h.onHoverChange(false),
  };
}

/**
 * Globo de diálogo: un Shape propio dibuja cuerpo + cola con la técnica de
 * "trazo doble y relleno encima" (ver lib/bubbles.ts) y un Text centrado.
 */
export function BubbleNode({ bubble, handlers }: { bubble: SpeechBubble; handlers: NodeHandlers }) {
  const geo = bubbleGeometry(bubble);
  const box = bubbleTextBox(bubble.kind, bubble.width, bubble.height);
  const fontFamily = resolveFont(bubble.fontFamily);
  const textSize = measureText({
    text: bubble.text,
    fontFamily,
    fontSize: bubble.fontSize,
    fontStyle: bubble.fontStyle,
    lineHeight: bubble.lineHeight,
    width: box.width,
  });
  const halfW = bubble.width / 2;
  const halfH = bubble.height / 2;

  const sceneFunc = (context: Konva.Context) => {
    const ctx = context._context as CanvasRenderingContext2D;
    const paths = geo.paths.map((d) => new Path2D(d));
    ctx.save();
    ctx.translate(halfW, halfH);
    if (bubble.strokeWidth > 0) {
      ctx.lineWidth = bubble.strokeWidth * 2;
      ctx.strokeStyle = bubble.stroke;
      ctx.lineJoin = geo.lineJoin;
      ctx.miterLimit = 6;
      ctx.setLineDash(geo.dash ?? []);
      paths.forEach((p) => ctx.stroke(p));
      ctx.setLineDash([]);
    }
    ctx.fillStyle = bubble.fill;
    paths.forEach((p) => ctx.fill(p));
    ctx.restore();
  };

  const hitFunc = (context: Konva.Context, shape: Konva.Shape) => {
    const ctx = context._context as CanvasRenderingContext2D;
    ctx.save();
    ctx.translate(halfW, halfH);
    ctx.fillStyle = shape.colorKey;
    geo.paths.forEach((d) => ctx.fill(new Path2D(d)));
    ctx.restore();
  };

  return (
    <Group {...groupProps(bubble, handlers)}>
      {/* x/y/width/height = cuerpo: el Transformer encuadra el globo sin la cola. */}
      <Shape x={-halfW} y={-halfH} width={bubble.width} height={bubble.height} sceneFunc={sceneFunc} hitFunc={hitFunc} />
      <Text
        x={-box.width / 2}
        y={-textSize.height / 2}
        width={box.width}
        text={bubble.text}
        fontFamily={fontFamily}
        fontStyle={bubble.fontStyle}
        fontSize={bubble.fontSize}
        lineHeight={bubble.lineHeight}
        align={bubble.align}
        wrap="word"
        fill={bubble.textColor}
        visible={!handlers.isTextHidden}
        listening={false}
      />
    </Group>
  );
}

/** Onomatopeya: texto con contorno por detrás del relleno, inclinable y vertical. */
export function SfxNode({ sfx, handlers }: { sfx: OnomatopoeiaElement; handlers: NodeHandlers }) {
  const text = sfx.vertical ? verticalize(sfx.text) : sfx.text;
  const fontFamily = resolveFont(sfx.fontFamily);
  const lineHeight = sfx.vertical ? 0.92 : 1;
  const size = measureText({
    text,
    fontFamily,
    fontSize: sfx.fontSize,
    fontStyle: sfx.fontStyle,
    letterSpacing: sfx.letterSpacing,
    lineHeight,
  });

  return (
    <Group {...groupProps(sfx, handlers)}>
      <Text
        text={text}
        fontFamily={fontFamily}
        fontStyle={sfx.fontStyle}
        fontSize={sfx.fontSize}
        lineHeight={lineHeight}
        letterSpacing={sfx.letterSpacing}
        align="center"
        fill={sfx.fill}
        stroke={sfx.stroke}
        strokeWidth={sfx.strokeWidth}
        fillAfterStrokeEnabled
        lineJoin="round"
        skewX={sfx.skewX}
        offsetX={size.width / 2}
        offsetY={size.height / 2}
        visible={!handlers.isTextHidden}
      />
    </Group>
  );
}
