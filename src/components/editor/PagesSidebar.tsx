"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { ArrowRight, Folder, FolderInput, FolderMinus, FolderPlus, Plus, Rows3, Trash2, X } from "lucide-react";
import { PagePreview } from "@/components/shared/PagePreview";
import { IconButton } from "@/components/ui/Button";
import { getFormat } from "@/lib/formats";
import {
  buildOutline,
  pageDropSlot,
  pageRowId,
  sectionDropSlot,
  type DropSlot,
  type OutlineRow,
  type RowBox,
} from "@/lib/page-outline";
import { useEditorStore } from "@/lib/store/editor-store";
import { cn, isTextEntryTarget } from "@/lib/utils";
import { MoveToMenu } from "./pages/MoveToMenu";
import { PageRow } from "./pages/PageRow";
import { SectionHeaderRow } from "./pages/SectionHeaderRow";
import { TemplatePickerDialog } from "./TemplatePickerDialog";

/** Solo arriba/abajo: la lista es vertical. */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** Tiempo sobre una subcategoría plegada antes de abrirla sola durante un arrastre. */
const SPRING_OPEN_MS = 650;

type Drag = { kind: "pages"; ids: string[]; primaryId: string } | { kind: "section"; sectionId: string } | null;
type Menu = { anchor: HTMLElement; ids: string[] } | null;

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
  const [slot, setSlot] = useState<DropSlot | null>(null);
  /** Dónde se agarró el elemento: la miniatura flotante se dibuja junto al cursor, sin tapar el destino. */
  const [grab, setGrab] = useState({ x: 0, y: 0 });
  const [menu, setMenu] = useState<Menu>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  // Preferencia de vista: se recuerda en este navegador.
  const [isCompact, setIsCompact] = useState(() => localStorage.getItem("koma:pages-compact") === "1");

  const listRef = useRef<HTMLOListElement>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const rowsRef = useRef<OutlineRow[]>([]);
  const dragRef = useRef<Drag>(null);
  const slotRef = useRef<DropSlot | null>(null);
  const pointerY = useRef(0);
  const springRef = useRef<{ id: string; since: number } | null>(null);

  const sensors = useSensors(
    // 6 px de margen: por debajo es un clic (seleccionar), por encima empieza el arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const pages = project?.pages;
  const sections = project?.sections;
  const collapsedSections = project?.collapsedSections;

  const rows = useMemo<OutlineRow[]>(() => {
    if (!pages || !sections) return [];
    const collapsed = new Set(collapsedSections);
    // La subcategoría que se arrastra se muestra plegada mientras tanto.
    if (drag?.kind === "section") collapsed.add(drag.sectionId);
    return buildOutline(pages, sections, collapsed);
  }, [pages, sections, collapsedSections, drag]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // ── Cálculo continuo del punto de soltado mientras se arrastra ──
  // (por frames: también se actualiza cuando la lista se desplaza sola).
  useEffect(() => {
    if (!drag) return;
    const handleMove = (e: PointerEvent) => {
      pointerY.current = e.clientY;
    };
    window.addEventListener("pointermove", handleMove);
    let frame = 0;
    const tick = () => {
      const list = listRef.current;
      const current = dragRef.current;
      if (list && current) {
        const boxes: RowBox[] = [];
        rowsRef.current.forEach((row) => {
          const el = rowEls.current.get(row.rowId);
          if (!el) return;
          const r = el.getBoundingClientRect();
          boxes.push({ row, top: r.top, bottom: r.bottom });
        });
        const listTop = list.getBoundingClientRect().top;
        const next =
          current.kind === "section"
            ? sectionDropSlot(boxes, pointerY.current, listTop, current.sectionId)
            : pageDropSlot(boxes, pointerY.current, listTop, new Set(current.ids.map(pageRowId)));
        const prev = slotRef.current;
        if (next?.key !== prev?.key || next?.lineY !== prev?.lineY) {
          slotRef.current = next;
          setSlot(next);
        }
        // Mantener el puntero sobre una subcategoría plegada la abre.
        const intoId = next?.intoSectionId ?? null;
        const isCollapsed = !!intoId && useEditorStore.getState().project?.collapsedSections.includes(intoId);
        if (intoId && isCollapsed) {
          if (springRef.current?.id !== intoId) springRef.current = { id: intoId, since: performance.now() };
          else if (performance.now() - springRef.current.since > SPRING_OPEN_MS) {
            useEditorStore.getState().toggleSectionCollapsed(intoId, false);
            springRef.current = null;
          }
        } else {
          springRef.current = null;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", handleMove);
    };
  }, [drag]);

  if (!project || !pages) return null;
  const format = getFormat(project.formatId);
  const orderOf = (ids: string[]) => pages.filter((p) => ids.includes(p.id)).map((p) => p.id);
  const sectionName = (id: string | null) =>
    id ? project.sections.find((s) => s.id === id)?.name || "Sin nombre" : null;

  // Selección válida (sin páginas borradas). Sin selección explícita, la página activa.
  const selection = orderOf(selectedIds);
  const effectiveSelection = selection.length ? selection : activePageId ? [activePageId] : [];
  const selectedSet = new Set(effectiveSelection);
  const isMultiSelecting = selection.length > 1;
  const idsFor = (pageId: string) => (isMultiSelecting && selectedSet.has(pageId) ? effectiveSelection : [pageId]);

  const measureRef = (rowId: string) => (el: HTMLElement | null) => {
    if (el) rowEls.current.set(rowId, el);
    else rowEls.current.delete(rowId);
  };

  const toggleCompact = () =>
    setIsCompact((v) => {
      localStorage.setItem("koma:pages-compact", v ? "0" : "1");
      return !v;
    });

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
  const groupPages = (ids: string[]) => {
    const id = createSection(ids);
    if (!id) return;
    toggleSectionCollapsed(id, false);
    setEditingSectionId(id); // nombrarla al momento
  };

  const moveIntoSection = (ids: string[], sectionId: string) => {
    movePagesTo(ids, { kind: "into", sectionId });
    toggleSectionCollapsed(sectionId, false); // que se vea dónde quedaron
  };

  /**
   * Alt+↑ / Alt+↓: mueve la página (o la selección) un puesto. Cruzar el límite
   * de una subcategoría es un paso propio: primero entra o sale, luego avanza.
   */
  const handleNudge = (pageId: string, direction: -1 | 1) => {
    const ids = idsFor(pageId);
    const idSet = new Set(ids);
    const moving = pages.filter((p) => idSet.has(p.id));
    const firstIdx = pages.indexOf(moving[0]);
    const lastIdx = pages.indexOf(moving[moving.length - 1]);
    const neighbor =
      direction < 0
        ? [...pages.slice(0, firstIdx)].reverse().find((p) => !idSet.has(p.id))
        : pages.slice(lastIdx + 1).find((p) => !idSet.has(p.id));
    // Subcategoría común de lo que se mueve (si vienen de varias, se trata como "suelto").
    const ownSection = moving.every((p) => p.sectionId === moving[0].sectionId) ? (moving[0].sectionId ?? null) : null;
    const neighborSection = neighbor?.sectionId ?? null;

    if (ownSection && neighborSection !== ownSection) {
      // Salir: queda justo fuera, en el borde por el que se sale.
      if (direction < 0) movePagesTo(ids, { kind: "section", sectionId: ownSection, position: "before", isCollapsed: false });
      else removePagesFromSection(ids);
      return;
    }
    if (!neighbor) return;
    if (neighborSection && neighborSection !== ownSection) {
      // Entrar: en el mismo sitio, pero ya dentro de la subcategoría vecina.
      movePagesTo(ids, { kind: "page", pageId: neighbor.id, position: direction < 0 ? "after" : "before" });
      toggleSectionCollapsed(neighborSection, false);
      return;
    }
    movePagesTo(ids, { kind: "page", pageId: neighbor.id, position: direction < 0 ? "before" : "after" });
  };

  const selectionInSections = effectiveSelection.some((id) => pages.find((p) => p.id === id)?.sectionId);

  // ── Arrastre ───────────────────────────────────────────────
  const handleDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const pointer = activatorEvent as PointerEvent;
    pointerY.current = pointer.clientY;
    // Medido del propio elemento (el rect inicial de dnd-kit aún no está listo en este momento).
    const box = rowEls.current.get(String(active.id))?.getBoundingClientRect();
    setGrab({ x: pointer.clientX - (box?.left ?? pointer.clientX), y: pointer.clientY - (box?.top ?? pointer.clientY) });
    setMenu(null);
    const id = String(active.id);
    let next: Drag;
    if (id.startsWith("section:")) {
      next = { kind: "section", sectionId: id.slice("section:".length) };
    } else {
      const pageId = id.slice("page:".length);
      // Si se arrastra una página seleccionada, se mueven todas las seleccionadas.
      const ids = idsFor(pageId);
      if (ids.length === 1) {
        setSelectedIds([pageId]);
        setAnchorId(pageId);
      }
      next = { kind: "pages", ids, primaryId: pageId };
    }
    dragRef.current = next;
    setDrag(next);
  };

  const finishDrag = (shouldApply: boolean) => {
    const current = dragRef.current;
    const target = slotRef.current?.target;
    dragRef.current = null;
    slotRef.current = null;
    springRef.current = null;
    setDrag(null);
    setSlot(null);
    if (!shouldApply || !current || !target) return;
    if (current.kind === "section") moveSectionTo(current.sectionId, target);
    else movePagesTo(current.ids, target);
  };

  const dragPreviewPage = drag?.kind === "pages" ? pages.find((p) => p.id === drag.primaryId) : undefined;
  const dragPreviewSection =
    drag?.kind === "section" ? project.sections.find((s) => s.id === drag.sectionId) : undefined;
  const draggedIds = new Set(drag?.kind === "pages" ? drag.ids : []);

  const destinationLabel = (() => {
    if (!slot || !drag) return null;
    if (drag.kind === "section") return slot.target.kind === "end" ? "Al final del capítulo" : "Mover aquí";
    if (slot.intoSectionId) return `Dentro de «${sectionName(slot.intoSectionId)}»`;
    if (slot.destinationSectionId) return `En «${sectionName(slot.destinationSectionId)}»`;
    return slot.target.kind === "end" ? "Al final, sin subcategoría" : "Sin subcategoría";
  })();

  const menuIds = menu?.ids ?? [];
  const menuSectionIds = new Set(menuIds.map((id) => pages.find((p) => p.id === id)?.sectionId ?? null));
  const menuCurrentSection = menuSectionIds.size === 1 ? [...menuSectionIds][0] : null;

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
            onClick={() => groupPages(effectiveSelection)}
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
          <IconButton
            label="Mover a…"
            size="sm"
            className="size-6"
            onClick={(e) => setMenu({ anchor: e.currentTarget, ids: selection })}
          >
            <FolderInput className="size-3.5" />
          </IconButton>
          <IconButton
            label="Agrupar en subcategoría nueva"
            size="sm"
            className="size-6"
            onClick={() => groupPages(selection)}
          >
            <FolderPlus className="size-3.5" />
          </IconButton>
          {selectionInSections && (
            <IconButton
              label="Sacar de su subcategoría"
              size="sm"
              className="size-6"
              onClick={() => removePagesFromSection(selection)}
            >
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
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={() => finishDrag(true)}
          onDragCancel={() => finishDrag(false)}
        >
          <ol ref={listRef} className={cn("relative flex flex-col pt-1", isCompact ? "gap-1.5" : "gap-3")}>
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
                  isDropTarget={slot?.intoSectionId === row.section.id}
                  isBeingDragged={drag?.kind === "section" && drag.sectionId === row.section.id}
                  measureRef={measureRef(row.rowId)}
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
                  isBeingDragged={draggedIds.has(row.page.id)}
                  canDelete={pages.length > 1}
                  measureRef={measureRef(row.rowId)}
                  onClick={(e) => handlePageClick(e, row.page.id)}
                  onNudge={(dir) => handleNudge(row.page.id, dir)}
                  onMoveTo={(anchor) => setMenu({ anchor, ids: idsFor(row.page.id) })}
                  onDuplicate={() => duplicatePage(row.page.id)}
                  onDelete={() => deletePage(row.page.id)}
                />
              ),
            )}

            {/* Línea de inserción: dónde caerá lo que se arrastra (sangrada si es dentro de una subcategoría). */}
            {slot?.lineY != null && (
              <li
                aria-hidden
                className="pointer-events-none absolute right-0 h-0.5 rounded-full bg-accent"
                style={{ top: slot.lineY - 1, left: slot.isIndented ? 38 : 26 }}
              >
                <span className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rounded-full border-2 border-accent bg-surface-1" />
              </li>
            )}
          </ol>

          <DragOverlay dropAnimation={null}>
            {drag && (
              // Miniatura pequeña a la derecha del cursor (como al arrastrar archivos):
              // la carpeta o la línea de destino quedan siempre a la vista.
              <div
                className="pointer-events-none flex items-start gap-1.5"
                style={{ marginLeft: grab.x + 12, marginTop: grab.y + 14 }}
              >
                {dragPreviewPage && drag.kind === "pages" && (
                  <div className="relative w-11 shrink-0 -rotate-2 overflow-hidden rounded-[3px] shadow-xl shadow-black/70 ring-2 ring-accent">
                    <PagePreview
                      format={format}
                      style={dragPreviewPage.style}
                      panels={dragPreviewPage.panels}
                      elements={dragPreviewPage.elements}
                      isBleed={dragPreviewPage.bleed}
                    />
                  </div>
                )}
                {dragPreviewSection && (
                  <span className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-accent bg-surface-2 px-2 shadow-xl shadow-black/70">
                    <Folder className="size-3.5 text-accent" />
                    <span className="max-w-32 truncate text-xs font-medium">{dragPreviewSection.name}</span>
                  </span>
                )}
                <div className="flex flex-col items-start gap-1">
                  {drag.kind === "pages" && drag.ids.length > 1 && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white shadow tabular-nums">
                      {drag.ids.length} páginas
                    </span>
                  )}
                  {destinationLabel && (
                    <span className="flex max-w-56 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-zinc-900 shadow-lg">
                      <ArrowRight className="size-3 shrink-0" />
                      <span className="truncate">{destinationLabel}</span>
                    </span>
                  )}
                </div>
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
          Arrastra una página sobre una carpeta para meterla. ⌘/Ctrl+clic o Shift+clic para elegir varias.
        </p>
      </div>

      {menu && (
        <MoveToMenu
          anchor={menu.anchor}
          pageCount={menuIds.length}
          sections={project.sections.map((s) => ({ ...s, size: pages.filter((p) => p.sectionId === s.id).length }))}
          currentSectionId={menuCurrentSection}
          isAnyInSection={[...menuSectionIds].some(Boolean)}
          onMoveToSection={(sid) => {
            moveIntoSection(menuIds, sid);
            setMenu(null);
          }}
          onRemoveFromSection={() => {
            removePagesFromSection(menuIds);
            setMenu(null);
          }}
          onCreateSection={() => {
            groupPages(menuIds);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}

      <TemplatePickerDialog
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onPick={(templateId) => addPage(templateId)}
      />
    </aside>
  );
}
