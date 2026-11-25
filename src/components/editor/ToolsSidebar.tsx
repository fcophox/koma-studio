"use client";

import { useState, type ReactNode } from "react";
import { Images, Layers, LayoutPanelTop, MessageCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectActivePage, useEditorStore } from "@/lib/store/editor-store";
import { AssetsTab } from "./tools/AssetsTab";
import { BubblesTab } from "./tools/BubblesTab";
import { LayersTab } from "./tools/LayersTab";
import { PageTab } from "./tools/PageTab";
import { SfxTab } from "./tools/SfxTab";

type TabId = "page" | "images" | "bubbles" | "sfx" | "layers";

const TABS: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: "page", label: "Página", icon: <LayoutPanelTop className="size-4" /> },
  { id: "images", label: "Imágenes", icon: <Images className="size-4" /> },
  { id: "bubbles", label: "Globos", icon: <MessageCircle className="size-4" /> },
  { id: "sfx", label: "SFX", icon: <Zap className="size-4" /> },
  { id: "layers", label: "Capas", icon: <Layers className="size-4" /> },
];

export function ToolsSidebar() {
  const [tab, setTab] = useState<TabId>("page");
  const selection = useEditorStore((s) => s.selection);
  const page = useEditorStore(selectActivePage);

  // Al seleccionar un globo u onomatopeya en el lienzo, mostrar su pestaña.
  // (Patrón "ajustar estado al cambiar una prop" de React, sin efectos.)
  const selectedElement =
    selection?.kind === "element" ? page?.elements.find((el) => el.id === selection.elementId) : undefined;
  const selectedKey = selectedElement ? selectedElement.id : null;
  const [prevSelectedKey, setPrevSelectedKey] = useState<string | null>(selectedKey);
  if (selectedKey !== prevSelectedKey) {
    setPrevSelectedKey(selectedKey);
    if (selectedElement && tab !== "layers") setTab(selectedElement.type === "bubble" ? "bubbles" : "sfx");
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-line bg-surface-1" aria-label="Herramientas">
      <div role="tablist" className="grid h-10 shrink-0 grid-cols-5 border-b border-line px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            title={t.label}
            aria-controls={`tabpanel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative flex items-center justify-center gap-1.5 text-xs font-medium transition-colors",
              tab === t.id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {t.icon}
            <span className="sr-only">{t.label}</span>
            {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto"
      >
        {tab === "page" && <PageTab />}
        {tab === "images" && <AssetsTab />}
        {tab === "bubbles" && <BubblesTab />}
        {tab === "sfx" && <SfxTab />}
        {tab === "layers" && <LayersTab />}
      </div>
    </aside>
  );
}
