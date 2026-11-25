"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Layer, Stage } from "react-konva";
import type Konva from "konva";
import { ImagePlus, Maximize, Minus, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { ELEMENT_DRAG_MIME, registerViewportCenter, type ElementDragPayload } from "@/lib/canvas-bridge";
import { createBubble, createCustomSfx, createSfx } from "@/lib/factory";
import { getFormat } from "@/lib/formats";
import { boundingBox, clamp, panelPolygon, pointInPolygon } from "@/lib/geometry";
import { copySelectedPanelFromButton, pasteIntoSelectedPanel } from "@/lib/panel-clipboard";
import { ACCEPT_ATTR, ASSET_DRAG_MIME, useAssetStore } from "@/lib/store/asset-store";
import { useFontsVersion } from "@/lib/hooks/use-fonts-version";
import { getSfxPreset } from "@/lib/sfx-catalog";
import { selectActivePage, selectActivePageIndex, useEditorStore } from "@/lib/store/editor-store";
import type { CanvasElement } from "@/lib/types";
import { cn, isModalOpen, isTypingTarget } from "@/lib/utils";
import { PageRenderer } from "./PageRenderer";
import { PanelActionBar } from "./PanelActionBar";
import { TextEditOverlay } from "./TextEditOverlay";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const FIT_PADDING = 56;

type View = { scale: number; x: number; y: number };
type Size = { width: number; height: number };

export function CanvasStage() {
  const project = useEditorStore((s) => s.project);
  const page = useEditorStore(selectActivePage);
  const pageIndex = useEditorStore(selectActivePageIndex);
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const editingPanelId = useEditorStore((s) => s.editingPanelId);
  const setEditingPanel = useEditorStore((s) => s.setEditingPanel);
  const setPanelImage = useEditorStore((s) => s.setPanelImage);
  const updatePanelImage = useEditorStore((s) => s.updatePanelImage);
  const importFiles = useAssetStore((s) => s.importFiles);
  const editingTextId = useEditorStore((s) => s.editingTextId);
  const panelClipboard = useEditorStore((s) => s.panelClipboard);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);
  const setEditingText = useEditorStore((s) => s.setEditingText);
  const addElement = useEditorStore((s) => s.addElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const fontsVersion = useFontsVersion();

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [hoveredPanelId, setHoveredPanelId] = useState<string | null>(null);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const didPanRef = useRef(false);
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [dropTargetPanelId, setDropTargetPanelId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filePickTargetRef = useRef<string | null>(null);
  const [isHoveringElement, setIsHoveringElement] = useState(false);

  const formatId = project?.formatId;
  const format = formatId ? getFormat(formatId) : null;

  // ── Tamaño del contenedor ──────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Encajar la página en pantalla ──────────────────────────
  const fit = useCallback(() => {
    if (!format || size.width === 0) return;
    const scale = clamp(
      Math.min((size.width - FIT_PADDING * 2) / format.width, (size.height - FIT_PADDING * 2) / format.height),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    // Webtoon: encajar a lo ancho y empezar arriba, no a toda la altura.
    const isTall = format.height / format.width > 2;
    const s = isTall ? clamp((size.width - FIT_PADDING * 2) / format.width, MIN_ZOOM, 1) : scale;
    setView({
      scale: s,
      x: (size.width - format.width * s) / 2,
      y: isTall ? FIT_PADDING : (size.height - format.height * s) / 2,
    });
  }, [format, size.width, size.height]);

  // Encajar al conocer el tamaño por primera vez y al cambiar de formato.
  const hasFittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!formatId || size.width === 0) return;
    if (hasFittedFor.current === formatId) return;
    hasFittedFor.current = formatId;
    fit();
  }, [formatId, size.width, fit]);

  // Los paneles laterales insertan elementos en el centro de lo visible.
  useEffect(() => {
    registerViewportCenter(() =>
      size.width > 0
        ? { x: (size.width / 2 - view.x) / view.scale, y: (size.height / 2 - view.y) / view.scale }
        : null,
    );
    return () => registerViewportCenter(null);
  }, [size.width, size.height, view]);

  const zoomAt = useCallback((factor: number, origin?: { x: number; y: number }) => {
    setView((v) => {
      const scale = clamp(v.scale * factor, MIN_ZOOM, MAX_ZOOM);
      const o = origin ?? { x: size.width / 2, y: size.height / 2 };
      const k = scale / v.scale;
      return { scale, x: o.x - (o.x - v.x) * k, y: o.y - (o.y - v.y) * k };
    });
  }, [size.width, size.height]);

  // ── Teclado: Espacio para mover, Ctrl +/−/0 para zoom ──────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isModalOpen()) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) setIsSpaceHeld(true);
      } else if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomAt(1.2);
      } else if (mod && e.key === "-") {
        e.preventDefault();
        zoomAt(1 / 1.2);
      } else if (mod && e.key === "0") {
        e.preventDefault();
        fit();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpaceHeld(false);
    };
    const handleBlur = () => setIsSpaceHeld(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [zoomAt, fit]);

  // ── Rueda: zoom centrado en el cursor ──────────────────────
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    // exp() da un zoom suave tanto con rueda (±100) como con trackpad (±2).
    const delta = clamp(e.evt.deltaY, -120, 120);
    zoomAt(Math.exp(-delta * (e.evt.ctrlKey ? 0.01 : 0.0018)), pointer);
  };

  // ── Pan: Espacio + arrastrar, o botón central ──────────────
  const handlePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    // Al tocar el lienzo, el teclado pasa a la página: se suelta el foco de
    // sliders/inputs del panel lateral y cualquier texto seleccionado, para que
    // Cmd+C / Cmd+V / Cmd+Z actúen sobre la viñeta. (Salvo en la barra de
    // acciones o el editor de texto, que tienen su propio foco.)
    const target = e.target as HTMLElement;
    if (!target.closest("button, textarea, input, [role=toolbar]")) {
      window.getSelection()?.removeAllRanges();
      containerRef.current?.focus({ preventScroll: true });
    }
    if (!(isSpaceHeld || e.button === 1)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    panRef.current = { x: e.clientX, y: e.clientY, moved: false };
    didPanRef.current = true;
    setIsPanning(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    const dx = e.clientX - pan.x;
    const dy = e.clientY - pan.y;
    pan.x = e.clientX;
    pan.y = e.clientY;
    pan.moved = true;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };

  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    panRef.current = null;
    setIsPanning(false);
  };

  // ── Selección ──────────────────────────────────────────────
  const handlePanelPointerDown = (panelId: string) => {
    if (isSpaceHeld || !page) return;
    select({ kind: "panel", pageId: page.id, panelId });
  };

  const handlePanelDblClick = (panelId: string) => {
    if (isSpaceHeld || !page) return;
    const panel = page.panels.find((p) => p.id === panelId);
    if (!panel) return;
    if (panel.image) {
      setEditingPanel(editingPanelId === panelId ? null : panelId);
    } else {
      // Viñeta vacía: doble clic abre el selector de archivos.
      filePickTargetRef.current = panelId;
      fileInputRef.current?.click();
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const panelId = filePickTargetRef.current;
    filePickTargetRef.current = null;
    if (!files.length || !page) return;
    const added = await importFiles(files);
    if (panelId && added[0]) {
      setPanelImage(page.id, panelId, added[0].id);
      select({ kind: "panel", pageId: page.id, panelId });
    }
  };

  // ── Drag & drop nativo: archivos del SO, imágenes de la biblioteca o elementos del catálogo ──
  const isAcceptedDrag = (dt: DataTransfer) =>
    dt.types.includes("Files") || dt.types.includes(ASSET_DRAG_MIME) || dt.types.includes(ELEMENT_DRAG_MIME);

  const clientToPage = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: (clientX - rect.left - view.x) / view.scale, y: (clientY - rect.top - view.y) / view.scale };
  };

  const panelAtClientPoint = (clientX: number, clientY: number): string | null => {
    const pt = clientToPage(clientX, clientY);
    if (!pt || !page || !format) return null;
    const hit = page.panels.find((pn) => pointInPolygon(pt, panelPolygon(pn, format, page.style, page.bleed)));
    return hit?.id ?? null;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isAcceptedDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (e.dataTransfer.types.includes(ELEMENT_DRAG_MIME)) return; // los elementos van donde se suelten
    if (!isDraggingOver) setIsDraggingOver(true);
    const target = panelAtClientPoint(e.clientX, e.clientY);
    if (target !== dropTargetPanelId) setDropTargetPanelId(target);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDraggingOver(false);
    setDropTargetPanelId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (!isAcceptedDrag(e.dataTransfer) || !page) return;
    e.preventDefault();

    const payload = e.dataTransfer.getData(ELEMENT_DRAG_MIME);
    if (payload) {
      const pt = clientToPage(e.clientX, e.clientY);
      const data = JSON.parse(payload) as ElementDragPayload;
      if (!pt) return;
      let el: CanvasElement | null = null;
      if (data.kind === "bubble") el = createBubble(data.bubbleKind, pt.x, pt.y);
      else if (data.kind === "sfx") {
        const preset = getSfxPreset(data.presetId);
        if (preset) el = createSfx(preset, pt.x, pt.y);
      } else el = createCustomSfx(data.text, pt.x, pt.y);
      if (el) addElement(page.id, el);
      return;
    }

    const panelId = panelAtClientPoint(e.clientX, e.clientY);
    setIsDraggingOver(false);
    setDropTargetPanelId(null);

    const assetId = e.dataTransfer.getData(ASSET_DRAG_MIME);
    if (assetId) {
      if (panelId) {
        setPanelImage(page.id, panelId, assetId);
        select({ kind: "panel", pageId: page.id, panelId });
      }
      return;
    }

    // Archivos del SO: todos se añaden a la biblioteca; el primero va a la viñeta.
    const added = await importFiles(Array.from(e.dataTransfer.files));
    if (panelId && added[0]) {
      setPanelImage(page.id, panelId, added[0].id);
      select({ kind: "panel", pageId: page.id, panelId });
    }
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    const target = e.target;
    if (target === target.getStage() || target.name() === "page-bg") select(null);
  };

  const isReady = !!project && !!page && !!format;
  const clipboardPanelId =
    panelClipboard?.mode && panelClipboard.sourcePageId === page?.id ? panelClipboard.sourcePanelId : null;
  const selectedPanelId =
    selection?.kind === "panel" && selection.pageId === page?.id ? selection.panelId : null;
  const selectedElementId =
    selection?.kind === "element" && selection.pageId === page?.id ? selection.elementId : null;
  const editingTextElement = editingTextId ? page?.elements.find((el) => el.id === editingTextId) : undefined;
  const cursor = isPanning
    ? "grabbing"
    : isSpaceHeld
      ? "grab"
      : (isHoveringImage && editingPanelId) || isHoveringElement
        ? "move"
        : hoveredPanelId
          ? "pointer"
          : "default";

  return (
    <div
      ref={containerRef}
      className="workspace-bg absolute inset-0 overflow-hidden outline-none"
      tabIndex={-1}
      aria-label="Lienzo de la página"
      style={{ cursor }}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMove={handlePointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onAuxClick={(e) => e.preventDefault()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={handleFilePicked}
        tabIndex={-1}
        aria-hidden
      />
      {isReady && size.width > 0 && (
        <Stage
          width={size.width}
          height={size.height}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onTouchStart={handleStageMouseDown}
        >
          {/* key: remontar al cargar fuentes para que Konva re-mida el texto. */}
          <Layer key={fontsVersion} listening={!isSpaceHeld}>
            <PageRenderer
              page={page}
              format={format}
              numbering={project.numbering}
              direction={project.readingDirection}
              printedNumber={project.numbering.startAt + pageIndex}
              mode="editor"
              uiScale={1 / view.scale}
              selectedPanelId={selectedPanelId}
              hoveredPanelId={hoveredPanelId}
              editingPanelId={editingPanelId}
              dropTargetPanelId={dropTargetPanelId}
              clipboardPanelId={clipboardPanelId}
              onPanelPointerDown={handlePanelPointerDown}
              onPanelDblClick={handlePanelDblClick}
              onPanelHover={setHoveredPanelId}
              onImageChange={(panelId, patch, key) => updatePanelImage(page.id, panelId, patch, key)}
              onImageHover={setIsHoveringImage}
              onExitImageEdit={() => setEditingPanel(null)}
              selectedElementId={selectedElementId}
              editingTextId={editingTextId}
              onElementSelect={(id) => !isSpaceHeld && select({ kind: "element", pageId: page.id, elementId: id })}
              onElementChange={(id, patch, key) => updateElement(page.id, id, patch, key)}
              onEditText={setEditingText}
              onElementHover={setIsHoveringElement}
            />
          </Layer>
        </Stage>
      )}

      {(() => {
        // Barra de acciones de la viñeta seleccionada (oculta al encuadrar o mover el lienzo).
        if (!page || !format || !selectedPanelId || editingPanelId || isPanning || isDraggingOver) return null;
        const index = page.panels.findIndex((pn) => pn.id === selectedPanelId);
        const panel = page.panels[index];
        if (!panel) return null;
        const box = boundingBox(panelPolygon(panel, format, page.style, page.bleed));
        return (
          <PanelActionBar
            box={box}
            view={view}
            panelNumber={index + 1}
            hasImage={!!panel.image}
            canPaste={!!panelClipboard}
            onCopy={() => copySelectedPanelFromButton("copy")}
            onCut={() => copySelectedPanelFromButton("cut")}
            onPaste={() => pasteIntoSelectedPanel()}
            onFrame={() => setEditingPanel(panel.id)}
            onRemove={deleteSelection}
            onPickFile={() => {
              filePickTargetRef.current = panel.id;
              fileInputRef.current?.click();
            }}
          />
        );
      })()}

      {editingTextElement && page && (
        <TextEditOverlay
          key={editingTextElement.id}
          element={editingTextElement}
          view={view}
          onChange={(text) => updateElement(page.id, editingTextElement.id, { text }, `el:${editingTextElement.id}:text`)}
          onDone={() => setEditingText(null)}
        />
      )}

      <div className="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-xl border border-line bg-surface-1/90 p-1 shadow-lg shadow-black/40 backdrop-blur">
        <IconButton label="Alejar (Ctrl −)" size="sm" onClick={() => zoomAt(1 / 1.2)}>
          <Minus className="size-3.5" />
        </IconButton>
        <button
          type="button"
          onClick={() => zoomAt(1 / view.scale)}
          title="Zoom al 100%"
          className="h-7 w-12 rounded-md text-xs text-zinc-300 tabular-nums hover:bg-surface-3"
        >
          {Math.round(view.scale * 100)}%
        </button>
        <IconButton label="Acercar (Ctrl +)" size="sm" onClick={() => zoomAt(1.2)}>
          <Plus className="size-3.5" />
        </IconButton>
        <div className="mx-0.5 h-4 w-px bg-line" />
        <IconButton label="Encajar página (Ctrl 0)" size="sm" onClick={fit}>
          <Maximize className="size-3.5" />
        </IconButton>
      </div>

      {isDraggingOver && (
        <div className="pointer-events-none absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent/40 bg-surface-1/95 px-3.5 py-1.5 text-xs text-zinc-200 shadow-lg backdrop-blur">
          <ImagePlus className="size-3.5 text-accent" />
          {dropTargetPanelId ? "Suelta para colocar en la viñeta" : "Suelta sobre una viñeta (o se añadirá a Imágenes)"}
        </div>
      )}

      <p
        className={cn(
          "pointer-events-none absolute bottom-5 left-4 text-[11px] text-zinc-600 transition-opacity",
          isPanning && "opacity-0",
        )}
      >
        {editingPanelId
          ? "Encuadre: arrastra para mover · esquinas para escalar · asa superior para rotar · Esc para salir"
          : selectedElementId
            ? "Doble clic: editar texto · arrastra el punto naranja para orientar la cola · Ctrl+D duplicar"
            : "Doble clic en viñeta: imagen / encuadre · Rueda: zoom · Espacio + arrastrar: mover"}
      </p>
    </div>
  );
}
