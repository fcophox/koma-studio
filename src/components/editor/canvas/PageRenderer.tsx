"use client";

import { Fragment } from "react";
import { Group, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import { CANVAS_FONTS } from "@/lib/fonts";
import { boundingBox, centroid, panelPolygon, toFlat, type Point } from "@/lib/geometry";
import { numberPlacement } from "@/lib/page-number";
import type { CanvasElement, Page, PageFormat, PageNumbering, ReadingDirection } from "@/lib/types";
import { formatPageNumber } from "@/lib/utils";
import { ElementsLayer } from "./ElementsLayer";
import { ImageEditOverlay, type ImagePatch } from "./ImageEditOverlay";
import { PanelImage } from "./PanelImage";

export type RenderMode = "editor" | "export";

type Props = {
  page: Page;
  format: PageFormat;
  numbering: PageNumbering;
  direction: ReadingDirection;
  printedNumber: number;
  mode: RenderMode;
  /** 1 / zoom: mantiene constante en pantalla el grosor de los adornos de UI. */
  uiScale?: number;
  selectedPanelId?: string | null;
  hoveredPanelId?: string | null;
  editingPanelId?: string | null;
  dropTargetPanelId?: string | null;
  onPanelPointerDown?: (panelId: string) => void;
  onPanelDblClick?: (panelId: string) => void;
  onPanelHover?: (panelId: string | null) => void;
  onImageChange?: (panelId: string, patch: ImagePatch, coalesceKey: string) => void;
  onImageHover?: (isHovering: boolean) => void;
  onExitImageEdit?: () => void;
  selectedElementId?: string | null;
  editingTextId?: string | null;
  onElementSelect?: (elementId: string) => void;
  onElementChange?: (elementId: string, patch: Partial<CanvasElement>, coalesceKey: string) => void;
  onEditText?: (elementId: string) => void;
  onElementHover?: (isHovering: boolean) => void;
};

const ACCENT = "#ff5a36";

function clipTo(points: Point[]) {
  return (ctx: Konva.Context) => {
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
  };
}

/**
 * Render de una página en Konva. Es el mismo componente para el editor y para
 * la exportación (Fase 5): en modo "export" no dibuja sombras, etiquetas,
 * hover, selección ni el modo encuadre.
 */
export function PageRenderer({
  page,
  format,
  numbering,
  direction,
  printedNumber,
  mode,
  uiScale = 1,
  selectedPanelId,
  hoveredPanelId,
  editingPanelId,
  dropTargetPanelId,
  onPanelPointerDown,
  onPanelDblClick,
  onPanelHover,
  onImageChange,
  onImageHover,
  onExitImageEdit,
  selectedElementId = null,
  editingTextId = null,
  onElementSelect,
  onElementChange,
  onEditText,
  onElementHover,
}: Props) {
  const isEditor = mode === "editor";
  const { style } = page;
  const placement = numberPlacement(format, style, numbering, printedNumber, direction);
  const textAlign = placement.anchor === "middle" ? "center" : placement.anchor === "end" ? "right" : "left";
  const numberBoxWidth = 200;
  const numberX =
    placement.anchor === "middle"
      ? placement.x - numberBoxWidth / 2
      : placement.anchor === "end"
        ? placement.x - numberBoxWidth
        : placement.x;

  const polygons = page.panels.map((panel) => panelPolygon(panel, format, style, page.bleed));
  const editingIndex = isEditor ? page.panels.findIndex((p) => p.id === editingPanelId && p.image) : -1;
  const editingPanel = editingIndex >= 0 ? page.panels[editingIndex] : null;

  return (
    <Group>
      {/* Página */}
      <Rect
        name="page-bg"
        width={format.width}
        height={format.height}
        fill={style.pageBackground}
        shadowEnabled={isEditor}
        shadowColor="#000"
        shadowBlur={40 * uiScale}
        shadowOpacity={0.55}
        shadowOffsetY={8 * uiScale}
      />

      {/* Todo lo que hay en la página se recorta a sus límites (sangre incluida). */}
      <Group clipX={0} clipY={0} clipWidth={format.width} clipHeight={format.height}>
        {page.panels.map((panel, i) => {
          const poly = polygons[i];
          const flat = toFlat(poly);
          const box = boundingBox(poly);
          const center = centroid(poly);
          const isSelected = isEditor && selectedPanelId === panel.id && !editingPanel;
          const isHovered = isEditor && !isSelected && !editingPanel && hoveredPanelId === panel.id;
          const isDropTarget = isEditor && dropTargetPanelId === panel.id;
          const labelSize = Math.min(box.width, box.height) * 0.16;

          return (
            <Fragment key={panel.id}>
              {/* Máscara: todo lo de dentro queda recortado por el polígono de la viñeta. */}
              <Group
                clipFunc={clipTo(poly)}
                onMouseDown={() => onPanelPointerDown?.(panel.id)}
                onTouchStart={() => onPanelPointerDown?.(panel.id)}
                onDblClick={() => onPanelDblClick?.(panel.id)}
                onDblTap={() => onPanelDblClick?.(panel.id)}
                onMouseEnter={() => onPanelHover?.(panel.id)}
                onMouseLeave={() => onPanelHover?.(null)}
              >
                <Rect x={box.x} y={box.y} width={box.width} height={box.height} fill={style.panelFill} />
                {panel.image && <PanelImage placed={panel.image} poly={poly} />}
                {isEditor && !panel.image && (
                  <Text
                    x={center.x - box.width / 2}
                    y={center.y - labelSize / 2}
                    width={box.width}
                    text={String(i + 1)}
                    align="center"
                    fontSize={labelSize}
                    fontFamily={CANVAS_FONTS.ui}
                    fontStyle="600"
                    fill="#000"
                    opacity={0.07}
                    listening={false}
                  />
                )}
              </Group>

              {style.borderWidth > 0 && (
                <Line
                  points={flat}
                  closed
                  stroke={style.borderColor}
                  strokeWidth={style.borderWidth}
                  lineJoin="miter"
                  listening={false}
                />
              )}

              {isDropTarget && (
                <Line
                  points={flat}
                  closed
                  fill={ACCENT}
                  opacity={0.22}
                  stroke={ACCENT}
                  strokeWidth={3 * uiScale}
                  listening={false}
                />
              )}

              {(isSelected || isHovered) && (
                <Line
                  points={flat}
                  closed
                  stroke={ACCENT}
                  strokeWidth={(isSelected ? 2.5 : 1.5) * uiScale}
                  dash={isHovered ? [6 * uiScale, 4 * uiScale] : undefined}
                  opacity={isHovered ? 0.8 : 1}
                  listening={false}
                />
              )}
            </Fragment>
          );
        })}
      </Group>

      {numbering.show && (
        <Text
          x={numberX}
          y={placement.y - numbering.fontSize / 2}
          width={numberBoxWidth}
          align={textAlign}
          text={formatPageNumber(printedNumber)}
          fontSize={numbering.fontSize}
          fontFamily={CANVAS_FONTS.ui}
          fill={numbering.color}
          listening={false}
        />
      )}

      {/* Globos y onomatopeyas, por encima de viñetas y número de página. */}
      <ElementsLayer
        page={page}
        isEditor={isEditor}
        isInteractive={!editingPanel}
        uiScale={uiScale}
        selectedId={selectedElementId}
        editingTextId={editingTextId}
        onSelect={(id) => onElementSelect?.(id)}
        onChange={(id, patch, key) => onElementChange?.(id, patch, key)}
        onEditText={(id) => onEditText?.(id)}
        onHoverChange={(v) => onElementHover?.(v)}
      />

      {/* Modo encuadre: fuera del recorte para poder agarrar la imagen completa. */}
      {editingPanel?.image && (
        <ImageEditOverlay
          key={editingPanel.id}
          placed={editingPanel.image}
          poly={polygons[editingIndex]}
          uiScale={uiScale}
          onChange={(patch, key) => onImageChange?.(editingPanel.id, patch, `image:${editingPanel.id}:${key}`)}
          onExit={() => onExitImageEdit?.()}
          onHoverChange={(v) => onImageHover?.(v)}
        />
      )}
    </Group>
  );
}
