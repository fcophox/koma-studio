"use client";

import { useEffect, useRef } from "react";
import { Circle, Line, Transformer } from "react-konva";
import type Konva from "konva";
import type { CanvasElement, Page, SpeechBubble } from "@/lib/types";
import { BubbleNode, SfxNode, type NodeHandlers } from "./ElementNodes";

const ACCENT = "#ff5a36";

type Props = {
  page: Page;
  isEditor: boolean;
  /** false mientras se encuadra una imagen: los elementos no capturan clics. */
  isInteractive: boolean;
  uiScale: number;
  selectedId: string | null;
  editingTextId: string | null;
  onSelect: (elementId: string) => void;
  onChange: (elementId: string, patch: Partial<CanvasElement>, coalesceKey: string) => void;
  onEditText: (elementId: string) => void;
  onHoverChange: (isHovering: boolean) => void;
};

/** Punto local de un elemento (sin escala ni rotación) → coordenadas de página. */
function toPage(el: CanvasElement, lx: number, ly: number) {
  const r = (el.rotation * Math.PI) / 180;
  const x = lx * el.scaleX;
  const y = ly * el.scaleY;
  return { x: el.x + x * Math.cos(r) - y * Math.sin(r), y: el.y + x * Math.sin(r) + y * Math.cos(r) };
}

function toLocal(el: CanvasElement, px: number, py: number) {
  const r = (el.rotation * Math.PI) / 180;
  const dx = px - el.x;
  const dy = py - el.y;
  return {
    x: (dx * Math.cos(r) + dy * Math.sin(r)) / el.scaleX,
    y: (-dx * Math.sin(r) + dy * Math.cos(r)) / el.scaleY,
  };
}

/**
 * Globos y onomatopeyas de la página (el orden del array es el z-index), con
 * un Transformer para escalar/rotar el seleccionado y un asa para la cola.
 */
export function ElementsLayer({
  page,
  isEditor,
  isInteractive,
  uiScale,
  selectedId,
  editingTextId,
  onSelect,
  onChange,
  onEditText,
  onHoverChange,
}: Props) {
  const nodes = useRef(new Map<string, Konva.Group>());
  const trRef = useRef<Konva.Transformer>(null);
  // Los eventos de transform pueden encadenarse antes del re-render: se lleva
  // aquí el último estado aplicado para que cada paso sea incremental.
  const live = useRef<CanvasElement | null>(null);

  const selected = page.elements.find((el) => el.id === selectedId) ?? null;
  const showTransformer = isEditor && isInteractive && !!selected && editingTextId !== selected.id && !selected.locked;

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = showTransformer && selectedId ? nodes.current.get(selectedId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [showTransformer, selectedId, page.elements]);

  const handleTransform = () => {
    const el = live.current;
    const node = el ? nodes.current.get(el.id) : undefined;
    if (!el || !node) return;

    if (el.type === "bubble") {
      // Globos: la escala se convierte en ancho/alto para que el texto refluya.
      const sx = node.scaleX();
      const sy = node.scaleY();
      node.scale({ x: el.scaleX, y: el.scaleY });
      const next: SpeechBubble = {
        ...el,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(48, el.width * (sx / el.scaleX)),
        height: Math.max(32, el.height * (sy / el.scaleY)),
        tail: { ...el.tail, tipX: el.tail.tipX * (sx / el.scaleX), tipY: el.tail.tipY * (sy / el.scaleY) },
      };
      live.current = next;
      onChange(el.id, next, `el:${el.id}:transform`);
    } else {
      const next = { ...el, x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() };
      live.current = next;
      onChange(el.id, next, `el:${el.id}:transform`);
    }
  };

  const handlersFor = (el: CanvasElement): NodeHandlers => ({
    isDraggable: isEditor && isInteractive,
    isTextHidden: editingTextId === el.id,
    nodeRef: (node) => {
      if (node) nodes.current.set(el.id, node);
      else nodes.current.delete(el.id);
    },
    onSelect: () => isEditor && onSelect(el.id),
    onDragMove: (x, y) => onChange(el.id, { x, y }, `el:${el.id}:drag`),
    onDblClick: () => isEditor && onEditText(el.id),
    onHoverChange,
  });

  const bubble = selected?.type === "bubble" ? selected : null;
  const tip = bubble ? toPage(bubble, bubble.tail.tipX, bubble.tail.tipY) : null;
  const showTail = showTransformer && !!bubble && bubble.tail.enabled && !!tip;

  return (
    <>
      {page.elements.map((el) =>
        el.type === "bubble" ? (
          <BubbleNode key={el.id} bubble={el} handlers={handlersFor(el)} />
        ) : (
          <SfxNode key={el.id} sfx={el} handlers={handlersFor(el)} />
        ),
      )}

      {isEditor && (
        <Transformer
          ref={trRef}
          visible={showTransformer}
          keepRatio={selected?.type === "sfx"}
          enabledAnchors={
            selected?.type === "sfx"
              ? ["top-left", "top-right", "bottom-left", "bottom-right"]
              : ["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]
          }
          rotateEnabled
          rotationSnaps={[0, 90, 180, 270]}
          rotationSnapTolerance={3}
          rotateAnchorOffset={26}
          anchorSize={9}
          anchorCornerRadius={2}
          anchorStroke={ACCENT}
          anchorFill="#ffffff"
          borderStroke={ACCENT}
          flipEnabled={false}
          ignoreStroke
          onTransformStart={() => {
            live.current = selected;
          }}
          onTransform={handleTransform}
          boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 16 ? oldBox : newBox)}
        />
      )}

      {/* Asa de la cola: arrástrala hacia el personaje que habla. */}
      {showTail && bubble && tip && (
        <>
          <Line
            points={[bubble.x, bubble.y, tip.x, tip.y]}
            stroke={ACCENT}
            strokeWidth={1 * uiScale}
            dash={[4 * uiScale, 4 * uiScale]}
            opacity={0.6}
            listening={false}
          />
          <Circle
            x={tip.x}
            y={tip.y}
            radius={7 * uiScale}
            fill={ACCENT}
            stroke="#ffffff"
            strokeWidth={2 * uiScale}
            draggable
            onMouseEnter={() => onHoverChange(true)}
            onMouseLeave={() => onHoverChange(false)}
            onDragMove={(e) => {
              const local = toLocal(bubble, e.target.x(), e.target.y());
              onChange(bubble.id, { tail: { ...bubble.tail, tipX: local.x, tipY: local.y } }, `el:${bubble.id}:tail`);
            }}
          />
        </>
      )}
    </>
  );
}
