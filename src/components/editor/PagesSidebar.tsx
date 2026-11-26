"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Folder, FolderMinus, FolderPlus, Plus, Rows3, Trash2, X } from "lucide-react";
import { PagePreview } from "@/components/shared/PagePreview";
import { IconButton } from "@/components/ui/Button";
import { getFormat } from "@/lib/formats";
import { buildOutline, type DropTarget, type OutlineRow } from "@/lib/page-outline";
import { useEditorStore } from "@/lib/store/editor-store";
import { cn, isTextEntryTarget } from "@/lib/utils";
import { PageRow } from "./pages/PageRow";
import { SectionHeaderRow } from "./pages/SectionHeaderRow";
import { TemplatePickerDialog } from "./TemplatePickerDialog";

/** Solo arriba/abajo: la lista es vertical. */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

type Drag = { kind: "pages"; ids: string[]; primaryId: string } | { kind: "section"; sectionId: string } | null;

export function PagesSidebar() {
  const project = useEditorStore((s) => s.project);
  const activePageId = useEditorStore((s) => s.activePageId);
  const addPage = useEditorStore((s) => s.addPage);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const deletePages = useEditorStore((s) => s.deletePages);
  const movePagesTo = useEditorStore((s) => s.movePagesTo);
  const moveSectionTo = useEditorStore((s) => s.moveSectionTo);
  const createSection = useEditorStore((s) => s.createSection);
  const renameSection = useEditorStore((s) => s.renameSection);
  const ungroupSection = useEditorStore((s) => s.ungroupSection);
  const removePagesFromSection = useEditorStore((s) => s.removePagesFromSection);
  const toggleSectionCollapsed = useEditorStore((s) => s.toggleSectionCollapsed);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  // Preferencia de vista: se recuerda en este navegador.
  const [isCompact, setIsCompact] = useState(() => localStorage.getItem("koma:pages-compact") === "1");
  const toggleCompact = () =>
    setIsCompact((v) => {
      localStorage.setItem("koma:pages-compact", v ? "0" : "1");
      return !v;
    });

  const sensors = useSensors(
    // 6 px de margen: por debajo es un clic (seleccionar), por encima empieza el arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pages = project?.pages;
  const sections = project?.sections;
  const collapsedSections = project?.collapsedSections;

  const rows = useMemo<OutlineRow[]>(() => {
    if (!pages || !sections) return [];
    const collapsed = new Set(collapsedSections);
    // Mientras se arrastra una subcategoría se muestra plegada; con varias
    // páginas, las que acompañan a la arrastrada se ocultan.
    if (drag?.kind === "section") collapsed.add(drag.sectionId);
    const hidden = drag?.kind === "pages" ? new Set(drag.ids.filter((id) => id !== drag.primaryId)) : new Set<string>();
    return buildOutline(pages, sections, collapsed, hidden);
  }, [pages, sections, collapsedSections, drag]);

  if (!project || !pages) return null;
  const format = getFormat(project.formatId);
  const orderOf = (ids: string[]) => pages.filter((p) => ids.includes(p.id)).map((p) => p.id);

  // Selección válida (sin páginas borradas). Sin selección explícita, la página activa.
  const selection = orderOf(selectedIds);
  const effectiveSelection = selection.length ? selection : activePageId ? [activePageId] : [];
  const selectedSet = new Set(effectiveSelection);
  const isMultiSelecting = selection.length > 1;

  // ── Selección ──────────────────────────────────────────────
  const handlePageClick = (e: React.MouseEvent, pageId: string) => {
    const anchor = anchorId ?? activePageId;
    if (e.shiftKey && anchor) {
      const from = pages.findIndex((p) => p.id === anchor);
      const to = pages.findIndex((p) => p.id === pageId);
      const [a, b] = from < to ? [from, to] : [to, from];
      setSelectedIds(pages.slice(a, b + 1).map((p) => p.id));
      setActivePage(pageId);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      const next = effectiveSelection.includes(pageId)
        ? effectiveSelection.filter((id) => id !== pageId)
        : [...effectiveSelection, pageId];
      setSelectedIds(next);
      setAnchorId(pageId);
      if (next.includes(pageId)) setActivePage(pageId);
      return;
    }
    setSelectedIds([pageId]);
    setAnchorId(pageId);
    setActivePage(pageId);
  };

  const handleSelectSection = (e: React.MouseEvent, sectionPageIds: string[]) => {
    const next =
      e.metaKey || e.ctrlKey ? orderOf([...new Set([...effectiveSelection, ...sectionPageIds])]) : sectionPageIds;
    setSelectedIds(next);
    setAnchorId(sectionPageIds[0]);
    if (!activePageId || !next.includes(activePageId)) setActivePage(sectionPageIds[0]);
  };

  const clearSelection = () => setSelectedIds(activePageId ? [activePageId] : []);

  // ── Acciones ───────────────────────────────────────────────
  const handleGroup = () => {
    const id = createSection(effectiveSelection);
    if (!id) return;
    toggleSectionCollapsed(id, false);
    setEditingSectionId(id); // nombrarla al momento
  };

  const selectionInSections = effectiveSelection.some((id) => pages.find((p) => p.id === id)?.sectionId);

  // ── Arrastre ───────────────────────────────────────────────
  const handleDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    if (id.startsWith("section:")) {
      setDrag({ kind: "section", sectionId: id.slice("section:".length) });
      return;
    }
    const pageId = id.slice("page:".length);
    // Si se arrastra una página seleccionada, se mueven todas las seleccionadas.
    const isPartOfSelection = selectedSet.has(pageId) && effectiveSelection.length > 1;
    if (!isPartOfSelection) {
      setSelectedIds([pageId]);
      setAnchorId(pageId);
    }
    setDrag({ kind: "pages", ids: isPartOfSelection ? effectiveSelection : [pageId], primaryId: pageId });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const current = drag;
    setDrag(null);
    if (!current || !over || active.id === over.id) return;

    const activeIndex = rows.findIndex((r) => r.rowId === active.id);
    const overIndex = rows.findIndex((r) => r.rowId === over.id);
    const overRow = rows[overIndex];
    if (activeIndex === -1 || !overRow) return;
    const position = overIndex > activeIndex ? "after" : "before";

    const target: DropTarget =
      overRow.kind === "page"
        ? { kind: "page", pageId: overRow.page.id, position }
        : {
            kind: "section",
            sectionId: overRow.section.id,
            position,
            isCollapsed: project.collapsedSections.includes(overRow.section.id),
          };

    if (current.kind === "section") moveSectionTo(current.sectionId, target);
    else movePagesTo(current.ids, target);
  };

  const dragPreviewPage = drag?.kind === "pages" ? pages.find((p) => p.id === drag.primaryId) : undefined;
  const dragPreviewSection =
    drag?.kind === "section" ? project.sections.find((s) => s.id === drag.sectionId) : undefined;

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r border-line bg-surface-1"
      aria-label="Páginas"
      onKeyDown={(e) => {
        if (isTextEntryTarget(e.target) || !isMultiSelecting) return;
        if (e.key === "Escape") {
          e.stopPropagation();
          clearSelection();
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          e.stopPropagation();
          deletePages(selection);
        }
      }}
    >
      <div className="flex h-10 items-center justify-between px-3">
        <h2 className="text-xs font-medium text-zinc-400">
          Páginas <span className="text-zinc-600 tabular-nums">· {pages.length}</span>
        </h2>
        <div className="flex items-center">
          <IconButton
            label={isCompact ? "Miniaturas grandes" : "Miniaturas pequeñas (ver más páginas)"}
            size="sm"
            isActive={isCompact}
            onClick={toggleCompact}
          >
            <Rows3 className="size-4" />
          </IconButton>
          <IconButton
            label={
              isMultiSelecting
                ? `Agrupar ${selection.length} páginas en una subcategoría`
                : "Nueva subcategoría con la página actual"
            }
            size="sm"
            onClick={handleGroup}
          >
            <FolderPlus className="size-4" />
          </IconButton>
          <IconButton label="Añadir página" size="sm" onClick={() => setIsPickerOpen(true)}>
            <Plus className="size-4" />
          </IconButton>
        </div>
      </div>

      {isMultiSelecting && (
        <div className="mx-3 mb-2 flex items-center gap-0.5 rounded-lg border border-accent/40 bg-accent-soft py-0.5 pr-0.5 pl-2">
          <span className="flex-1 truncate text-[11px] font-medium whitespace-nowrap text-zinc-100 tabular-nums">
            {selection.length} seleccionadas
          </span>
          <IconButton label="Agrupar en subcategoría" size="sm" className="size-6" onClick={handleGroup}>
            <FolderPlus className="size-3.5" />
          </IconButton>
          {selectionInSections && (
            <IconButton label="Sacar de su subcategoría" size="sm" className="size-6" onClick={() => removePagesFromSection(selection)}>
              <FolderMinus className="size-3.5" />
            </IconButton>
          )}
          <IconButton
            label="Eliminar las páginas seleccionadas (Supr)"
            size="sm"
            onClick={() => deletePages(selection)}
            className="size-6 hover:text-red-300"
          >
            <Trash2 className="size-3.5" />
          </IconButton>
          <IconButton label="Quitar la selección (Esc)" size="sm" className="size-6" onClick={clearSelection}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      )}

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDrag(null)}
        >
          <SortableContext items={rows.map((r) => r.rowId)} strategy={verticalListSortingStrategy}>
            <ol className={isCompact ? "flex flex-col gap-1.5 pt-1" : "flex flex-col gap-3 pt-1"}>
              {rows.map((row) =>
                row.kind === "section" ? (
                  <SectionHeaderRow
                    key={row.rowId}
                    rowId={row.rowId}
                    section={row.section}
                    pageCount={row.pageIds.length}
                    firstNumber={project.numbering.startAt + row.firstIndex}
                    isCollapsed={row.isCollapsed}
                    isEditing={editingSectionId === row.section.id}
                    isSelected={isMultiSelecting && row.pageIds.every((id) => selectedSet.has(id))}
                    onToggle={() => toggleSectionCollapsed(row.section.id)}
                    onSelectPages={(e) => handleSelectSection(e, row.pageIds)}
                    onStartEdit={() => setEditingSectionId(row.section.id)}
                    onRename={(name) => renameSection(row.section.id, name)}
                    onEndEdit={() => setEditingSectionId(null)}
                    onUngroup={() => ungroupSection(row.section.id)}
                    onDelete={() => deletePages(row.pageIds)}
                  />
                ) : (
                  <PageRow
                    key={row.rowId}
                    rowId={row.rowId}
                    page={row.page}
                    index={row.index}
                    format={format}
                    numbering={project.numbering}
                    direction={project.readingDirection}
                    isInSection={!!row.sectionId}
                    isActive={row.page.id === activePageId}
                    isSelected={selectedSet.has(row.page.id)}
                    isMultiSelecting={isMultiSelecting}
                    isCompact={isCompact}
                    canDelete={pages.length > 1}
                    onClick={(e) => handlePageClick(e, row.page.id)}
                    onDuplicate={() => duplicatePage(row.page.id)}
                    onDelete={() => deletePage(row.page.id)}
                  />
                ),
              )}
            </ol>
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {dragPreviewPage && drag?.kind === "pages" && (
              <div
                className={cn(
                  "relative ml-7 rotate-1 overflow-hidden rounded-[4px] shadow-2xl shadow-black/70 ring-2 ring-accent",
                  isCompact && "w-[72px]",
                )}
              >
                <PagePreview
                  format={format}
                  style={dragPreviewPage.style}
                  panels={dragPreviewPage.panels}
                  elements={dragPreviewPage.elements}
                  isBleed={dragPreviewPage.bleed}
                />
                {drag.ids.length > 1 && (
                  <span className="absolute top-1.5 right-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white shadow tabular-nums">
                    {drag.ids.length} páginas
                  </span>
                )}
              </div>
            )}
            {dragPreviewSection && (
              <div className="flex h-9 items-center gap-1.5 rounded-lg border border-accent bg-surface-2 px-2 shadow-2xl shadow-black/70">
                <Folder className="size-3.5 text-accent" />
                <span className="truncate text-xs font-medium">{dragPreviewSection.name}</span>
                <span className="ml-auto text-[10px] text-zinc-400 tabular-nums">
                  {pages.filter((p) => p.sectionId === dragPreviewSection.id).length} págs.
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="mt-3 ml-7 flex w-[calc(100%-1.75rem)] items-center justify-center gap-1.5 rounded-md border border-dashed border-line-strong py-3 text-xs text-zinc-400 transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="size-3.5" /> Añadir página
        </button>
        <p className="mt-3 ml-7 text-[10px] leading-relaxed text-zinc-600">
          ⌘/Ctrl+clic o Shift+clic para elegir varias. Arrastra para moverlas juntas.
        </p>
      </div>

      <TemplatePickerDialog
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onPick={(templateId) => addPage(templateId)}
      />
    </aside>
  );
}
