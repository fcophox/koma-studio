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
  | { kind: "section"; sectionId: string; position: "before" | "after"; isCollapsed: boolean };

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

  if (target.kind === "page") {
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

  // Las subcategorías no se anidan: si el destino está dentro de otra, se usa la otra entera.
  const otherSection =
    target.kind === "section" ? target.sectionId : (rest.find((p) => p.id === target.pageId)?.sectionId ?? null);

  if (otherSection) {
    const { first, last } = sectionBounds(rest, otherSection);
    if (first === -1) return pages;
    at = target.position === "before" ? first : last + 1;
  } else if (target.kind === "page") {
    const i = rest.findIndex((p) => p.id === target.pageId);
    if (i === -1) return pages;
    at = i + (target.position === "after" ? 1 : 0);
  } else {
    return pages;
  }

  return [...rest.slice(0, at), ...block, ...rest.slice(at)];
}
