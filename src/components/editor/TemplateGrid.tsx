"use client";

import { TemplatePreview } from "@/components/shared/TemplatePreview";
import { PANEL_TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/templates";
import type { PageFormat, PanelStyle, ReadingDirection } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  format: PageFormat;
  style: PanelStyle;
  direction: ReadingDirection;
  selectedId?: string;
  columns?: 3 | 6;
  onPick: (templateId: string) => void;
};

const CATEGORY_ORDER = Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[];

/** Biblioteca de plantillas agrupada por categoría. */
export function TemplateGrid({ format, style, direction, selectedId, columns = 3, onPick }: Props) {
  // En Webtoon las miniaturas serían demasiado altas: se recortan a 3:4.
  const isTall = format.height / format.width > 2;

  return (
    <div className="flex flex-col gap-5">
      {CATEGORY_ORDER.map((cat) => (
        <section key={cat}>
          <h3 className="mb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            {TEMPLATE_CATEGORIES[cat]}
          </h3>
          <div className={cn("grid gap-2", columns === 6 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-3")}>
            {PANEL_TEMPLATES.filter((t) => t.category === cat).map((tpl) => {
              const isSelected = tpl.id === selectedId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onPick(tpl.id)}
                  aria-pressed={isSelected}
                  title={tpl.name}
                  className={cn(
                    "group flex flex-col gap-1.5 rounded-lg p-1.5 text-left transition-colors",
                    isSelected ? "bg-accent-soft ring-1 ring-accent" : "hover:bg-surface-3",
                  )}
                >
                  <span className={cn("block overflow-hidden rounded-[3px]", isTall && "aspect-[3/4]")}>
                    <TemplatePreview
                      templateId={tpl.id}
                      format={format}
                      style={style}
                      direction={direction}
                      className={isTall ? "h-full w-full" : undefined}
                    />
                  </span>
                  <span
                    className={cn(
                      "truncate text-[10px] leading-tight",
                      isSelected ? "text-accent" : "text-zinc-400 group-hover:text-zinc-200",
                    )}
                  >
                    {tpl.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
