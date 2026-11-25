"use client";

import { useId } from "react";
import { useAssetImage } from "@/lib/hooks/use-asset-image";
import { imageLayout, panelPolygon, type Point } from "@/lib/geometry";
import { numberPlacement } from "@/lib/page-number";
import { ElementSvg } from "./ElementSvg";
import type { CanvasElement, PageFormat, PageNumbering, PanelSlot, PanelStyle, PlacedImage, ReadingDirection } from "@/lib/types";
import { cn, formatPageNumber } from "@/lib/utils";

type Props = {
  format: PageFormat;
  style: PanelStyle;
  panels: PanelSlot[];
  elements?: CanvasElement[];
  isBleed: boolean;
  numbering?: PageNumbering;
  /** Número impreso (ya calculado con startAt). */
  printedNumber?: number;
  direction?: ReadingDirection;
  className?: string;
};

/** Imagen de una viñeta en SVG, con el mismo encuadre que en el lienzo. */
function PreviewPanelImage({ placed, poly, clipId }: { placed: PlacedImage; poly: Point[]; clipId: string }) {
  const image = useAssetImage(placed.assetId);
  if (!image) return <polygon points={poly.map((p) => `${p.x},${p.y}`).join(" ")} fill="#d4d4da" />;
  const l = imageLayout(placed, image.naturalWidth, image.naturalHeight, poly);
  return (
    <g clipPath={`url(#${clipId})`}>
      <g transform={`translate(${l.cx} ${l.cy}) rotate(${l.rotation})`}>
        <image
          href={image.src}
          x={-l.width / 2}
          y={-l.height / 2}
          width={l.width}
          height={l.height}
          preserveAspectRatio="none"
          transform={l.flipX ? "scale(-1 1)" : undefined}
        />
      </g>
    </g>
  );
}

/**
 * Miniatura vectorial (SVG) de una página: se recalcula en cada render a
 * partir del estado, así que siempre está "en vivo" y no cuesta rasterizar.
 */
export function PagePreview({ format, style, panels, elements = [], isBleed, numbering, printedNumber, direction = "ltr", className }: Props) {
  const { width, height } = format;
  const showNumber = numbering?.show && printedNumber !== undefined;
  const placement =
    numbering && printedNumber !== undefined
      ? numberPlacement(format, style, numbering, printedNumber, direction)
      : null;
  const uid = useId().replace(/:/g, "");
  const strokeWidth = style.borderWidth === 0 ? 0 : Math.max(style.borderWidth, width / 180);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block", className ?? "h-auto w-full")}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <rect width={width} height={height} fill={style.pageBackground} />
      {panels.map((panel) => {
        const poly = panelPolygon(panel, format, style, isBleed);
        const pts = poly.map((p) => `${p.x},${p.y}`).join(" ");
        const clipId = `clip-${uid}-${panel.id}`;
        return (
          <g key={panel.id}>
            <defs>
              <clipPath id={clipId}>
                <polygon points={pts} />
              </clipPath>
            </defs>
            <polygon points={pts} fill={style.panelFill} />
            {panel.image && <PreviewPanelImage placed={panel.image} poly={poly} clipId={clipId} />}
            {strokeWidth > 0 && (
              <polygon
                points={pts}
                fill="none"
                stroke={style.borderColor}
                strokeWidth={strokeWidth}
                strokeLinejoin="miter"
              />
            )}
          </g>
        );
      })}
      {showNumber && numbering && placement && (
        <text
          x={placement.x}
          y={placement.y}
          textAnchor={placement.anchor}
          dominantBaseline="middle"
          fontSize={Math.max(numbering.fontSize, width / 26)}
          fill={numbering.color}
          fontFamily="system-ui, sans-serif"
        >
          {formatPageNumber(printedNumber)}
        </text>
      )}
      {elements.map((el) => (
        <ElementSvg key={el.id} el={el} />
      ))}
    </svg>
  );
}
