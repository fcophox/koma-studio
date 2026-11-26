/**
 * Subcategorías del panel de páginas.
 *
 * El orden real del capítulo es `project.pages` (lista plana, base de la
 * numeración y la exportación). Una subcategoría es un nombre más el
 * `sectionId` de sus páginas, que siempre son consecutivas. Estas funciones
 * puras construyen la vista (encabezados + páginas) y calculan los
 * movimientos manteniendo esa regla.
 */
import type { Page, PageSection } from "./types";

export type OutlineRow =
  | { kind: "section"; rowId: string; section: PageSection; pageIds: string[]; firstIndex: number; isCollapsed: boolean }
  | { kind: "page"; rowId: string; page: Page; index: number; sectionId: string | null };

export const pageRowId = (id: string) => `page:${id}`;
export const sectionRowId = (id: string) => `section:${id}`;

/**
 * Filas visibles: un encabezado por subcategoría seguido de sus páginas
 * (salvo que esté plegada). `hiddenPageIds` oculta páginas mientras se
 * arrastran en bloque.
 */
export function buildOutline(
  pages: Page[],
  sections: PageSection[],
  collapsed: ReadonlySet<string>,
  hiddenPageIds: ReadonlySet<string> = new Set(),
): OutlineRow[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const rows: OutlineRow[] = [];
  let current: string | null = null;

  pages.forEach((page, index) => {
    const sectionId = page.sectionId && byId.has(page.sectionId) ? page.sectionId : null;
    if (sectionId && sectionId !== current) {
      rows.push({
        kind: "section",
        rowId: sectionRowId(sectionId),
        section: byId.get(sectionId)!,
        pageIds: pages.filter((p) => p.sectionId === sectionId).map((p) => p.id),
        firstIndex: index,
        isCollapsed: collapsed.has(sectionId),
      });
    }
    current = sectionId;
    if (sectionId && collapsed.has(sectionId)) return;
    if (hiddenPageIds.has(page.id)) return;
    rows.push({ kind: "page", rowId: pageRowId(page.id), page, index, sectionId });
  });

  return rows;
}

/**
 * Asegura la regla: páginas de una subcategoría consecutivas (se juntan donde
 * aparece la primera), sin referencias a subcategorías inexistentes, y sin
 * subcategorías vacías.
 */
export function normalizeSections(pages: Page[], sections: PageSection[]): { pages: Page[]; sections: PageSection[] } {
  const known = new Set(sections.map((s) => s.id));
  const cleaned = pages.map((p) => (p.sectionId && !known.has(p.sectionId) ? { ...p, sectionId: null } : p));

  const out: Page[] = [];
  const placed = new Set<string>();
  cleaned.forEach((p) => {
    if (!p.sectionId) return out.push(p);
    if (placed.has(p.sectionId)) return; // ya se añadió con su grupo
    placed.add(p.sectionId);
    out.push(...cleaned.filter((q) => q.sectionId === p.sectionId));
  });

  const used = new Set(out.map((p) => p.sectionId).filter(Boolean));
  return { pages: out, sections: sections.filter((s) => used.has(s.id)) };
}

function sectionBounds(pages: Page[], sectionId: string) {
  const first = pages.findIndex((p) => p.sectionId === sectionId);
  let last = first;
  while (last + 1 < pages.length && pages[last + 1].sectionId === sectionId) last++;
  return { first, last };
}

export type DropTarget =
  | { kind: "page"; pageId: string; position: "before" | "after" }
  | { kind: "section"; sectionId: string; position: "before" | "after"; isCollapsed: boolean }
  /** Dentro de una subcategoría, al final (soltar sobre su carpeta). */
  | { kind: "into"; sectionId: string }
  /** Al final del capítulo, fuera de subcategorías. */
  | { kind: "end" };

/**
 * Mueve un conjunto de páginas (en su orden actual) junto al destino.
 * Pertenencia resultante:
 * - sobre una página → la subcategoría de esa página;
 * - después de un encabezado abierto → al inicio de esa subcategoría;
 * - antes de un encabezado, o después de uno plegado → fuera de subcategorías.
 */
export function movePages(pages: Page[], ids: string[], target: DropTarget): Page[] {
  const moving = new Set(ids);
  const block = pages.filter((p) => moving.has(p.id));
  const rest = pages.filter((p) => !moving.has(p.id));
  let at: number;
  let sectionId: string | null;

  if (target.kind === "end") {
    at = rest.length;
    sectionId = null;
  } else if (target.kind === "into") {
    const { first, last } = sectionBounds(rest, target.sectionId);
    // Si solo quedaban las páginas que se mueven, se quedan en su sitio dentro de la subcategoría.
    at = first === -1 ? pages.findIndex((p) => moving.has(p.id)) : last + 1;
    sectionId = target.sectionId;
  } else if (target.kind === "page") {
    const i = rest.findIndex((p) => p.id === target.pageId);
    if (i === -1) return pages;
    at = i + (target.position === "after" ? 1 : 0);
    sectionId = rest[i].sectionId ?? null;
  } else {
    const { first, last } = sectionBounds(rest, target.sectionId);
    if (first === -1) {
      // La subcategoría solo tenía las páginas que se mueven: se quedan donde estaban.
      return pages;
    }
    if (target.position === "before") {
      at = first;
      sectionId = null;
    } else if (target.isCollapsed) {
      at = last + 1;
      sectionId = null;
    } else {
      at = first;
      sectionId = target.sectionId;
    }
  }

  return [...rest.slice(0, at), ...block.map((p) => ({ ...p, sectionId })), ...rest.slice(at)];
}

/** Mueve una subcategoría completa (bloque) antes o después del destino. */
export function moveSection(pages: Page[], sectionId: string, target: DropTarget): Page[] {
  const block = pages.filter((p) => p.sectionId === sectionId);
  const rest = pages.filter((p) => p.sectionId !== sectionId);
  let at: number;

  if (target.kind === "end") return [...rest, ...block];

  // Las subcategorías no se anidan: si el destino está dentro de otra, se usa la otra entera.
  const otherSection =
    target.kind === "section" || target.kind === "into"
      ? target.sectionId
      : (rest.find((p) => p.id === target.pageId)?.sectionId ?? null);

  if (otherSection) {
    const { first, last } = sectionBounds(rest, otherSection);
    if (first === -1) return pages;
    at = target.kind !== "into" && target.position === "before" ? first : last + 1;
  } else if (target.kind === "page") {
    const i = rest.findIndex((p) => p.id === target.pageId);
    if (i === -1) return pages;
    at = i + (target.position === "after" ? 1 : 0);
  } else {
    return pages;
  }

  return [...rest.slice(0, at), ...block, ...rest.slice(at)];
}

// ── Punto de soltado mientras se arrastra ─────────────────────

export interface RowBox {
  row: OutlineRow;
  top: number;
  bottom: number;
}

export interface DropSlot {
  target: DropTarget;
  /** Clave estable para no re-renderizar si no cambia. */
  key: string;
  /** Línea de inserción (y relativa a la lista); null si se suelta "sobre" una carpeta. */
  lineY: number | null;
  /** La línea va sangrada: el destino está dentro de una subcategoría. */
  isIndented: boolean;
  /** Subcategoría resaltada como destino (soltar sobre su encabezado). */
  intoSectionId: string | null;
  /** Subcategoría donde acabarán las páginas (null = sin subcategoría). */
  destinationSectionId: string | null;
}

const GAP = 6;

/**
 * Dónde caen PÁGINAS según la posición del puntero (reglas visibles, no
 * dependen de si se arrastra hacia arriba o abajo):
 * - mitad superior / inferior de una página → antes / después de ella, en su
 *   misma subcategoría (o ninguna);
 * - franja superior de un encabezado → justo antes de esa subcategoría (fuera);
 * - resto del encabezado → DENTRO de la subcategoría, al final (como una carpeta);
 * - debajo de todo → al final del capítulo, fuera de subcategorías.
 */
export function pageDropSlot(boxes: RowBox[], pointerY: number, listTop: number, skip: ReadonlySet<string>): DropSlot | null {
  const candidates = boxes.filter((b) => !skip.has(b.row.rowId));
  if (!candidates.length) return null;
  const last = candidates[candidates.length - 1];

  if (pointerY > last.bottom + GAP) {
    return { target: { kind: "end" }, key: "end", lineY: last.bottom - listTop + GAP, isIndented: false, intoSectionId: null, destinationSectionId: null };
  }

  const box =
    candidates.find((b) => pointerY >= b.top - GAP && pointerY <= b.bottom + GAP) ??
    candidates.reduce((a, b) =>
      Math.abs((a.top + a.bottom) / 2 - pointerY) < Math.abs((b.top + b.bottom) / 2 - pointerY) ? a : b,
    );
  const { row } = box;
  const ratio = (pointerY - box.top) / Math.max(1, box.bottom - box.top);

  if (row.kind === "section") {
    if (ratio < 0.3) {
      return {
        target: { kind: "section", sectionId: row.section.id, position: "before", isCollapsed: row.isCollapsed },
        key: `before:${row.rowId}`,
        lineY: box.top - listTop - GAP,
        isIndented: false,
        intoSectionId: null,
        destinationSectionId: null,
      };
    }
    return {
      target: { kind: "into", sectionId: row.section.id },
      key: `into:${row.section.id}`,
      lineY: null,
      isIndented: true,
      intoSectionId: row.section.id,
      destinationSectionId: row.section.id,
    };
  }

  const position = ratio < 0.5 ? "before" : "after";
  return {
    target: { kind: "page", pageId: row.page.id, position },
    key: `${position}:${row.rowId}`,
    lineY: position === "before" ? box.top - listTop - GAP : box.bottom - listTop + GAP,
    isIndented: !!row.sectionId,
    intoSectionId: null,
    destinationSectionId: row.sectionId,
  };
}

/** Dónde cae una SUBCATEGORÍA entera: siempre entre bloques, nunca dentro de otra. */
export function sectionDropSlot(
  boxes: RowBox[],
  pointerY: number,
  listTop: number,
  draggedSectionId: string,
): DropSlot | null {
  // Agrupar filas en bloques de primer nivel: página suelta o subcategoría completa.
  type Block = { top: number; bottom: number; target: (pos: "before" | "after") => DropTarget; id: string };
  const blocks: Block[] = [];
  for (const b of boxes) {
    const sid = b.row.kind === "section" ? b.row.section.id : b.row.sectionId;
    if (sid === draggedSectionId) continue;
    const prev = blocks[blocks.length - 1];
    if (sid && prev?.id === `s:${sid}`) {
      prev.bottom = b.bottom;
      continue;
    }
    if (sid && b.row.kind === "section") {
      const isCollapsed = b.row.isCollapsed;
      blocks.push({ id: `s:${sid}`, top: b.top, bottom: b.bottom, target: (position) => ({ kind: "section", sectionId: sid, position, isCollapsed }) });
    } else if (b.row.kind === "page") {
      const pageId = b.row.page.id;
      blocks.push({ id: `p:${pageId}`, top: b.top, bottom: b.bottom, target: (position) => ({ kind: "page", pageId, position }) });
    }
  }
  if (!blocks.length) return null;
  const last = blocks[blocks.length - 1];
  if (pointerY > last.bottom + GAP) {
    return { target: { kind: "end" }, key: "end", lineY: last.bottom - listTop + GAP, isIndented: false, intoSectionId: null, destinationSectionId: null };
  }
  const block =
    blocks.find((b) => pointerY >= b.top - GAP && pointerY <= b.bottom + GAP) ??
    blocks.reduce((a, b) => (Math.abs((a.top + a.bottom) / 2 - pointerY) < Math.abs((b.top + b.bottom) / 2 - pointerY) ? a : b));
  const position = pointerY < (block.top + block.bottom) / 2 ? "before" : "after";
  return {
    target: block.target(position),
    key: `${position}:${block.id}`,
    lineY: position === "before" ? block.top - listTop - GAP : block.bottom - listTop + GAP,
    isIndented: false,
    intoSectionId: null,
    destinationSectionId: null,
  };
}
