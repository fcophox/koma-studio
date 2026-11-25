import { useMemo } from "react";
import { mirrorNormalized } from "@/lib/geometry";
import { getTemplate } from "@/lib/templates";
import type { PageFormat, PanelSlot, PanelStyle, ReadingDirection } from "@/lib/types";
import { PagePreview } from "./PagePreview";

type Props = {
  templateId: string;
  format: PageFormat;
  style: PanelStyle;
  direction: ReadingDirection;
  className?: string;
};

/** Vista previa de una plantilla tal como quedaría en el proyecto actual. */
export function TemplatePreview({ templateId, format, style, direction, className }: Props) {
  const tpl = getTemplate(templateId);
  const panels = useMemo<PanelSlot[]>(
    () =>
      tpl.panels.map((pts, i) => ({
        id: `${tpl.id}-${i}`,
        points: direction === "rtl" ? mirrorNormalized(pts) : pts,
        image: null,
      })),
    [tpl, direction],
  );

  // Las miniaturas pequeñas necesitan bordes y gutter proporcionalmente más gruesos.
  const previewStyle: PanelStyle = {
    ...style,
    borderWidth: Math.max(style.borderWidth, format.width / 90),
    gutter: Math.max(style.gutter, format.width / 30),
    panelFill: "#ffffff",
    pageBackground: "#e9e9ee",
  };

  return (
    <PagePreview
      format={format}
      style={previewStyle}
      panels={panels}
      isBleed={!!tpl.bleed}
      className={className}
    />
  );
}
