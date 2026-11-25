"use client";

/**
 * "Empaquetar proyecto": vuelca el proyecto a una carpeta real del disco con
 * una estructura ordenada, y permite traer de vuelta las imágenes que el
 * usuario vaya dejando en esas carpetas.
 *
 *   <Proyecto>/
 *     proyecto.koma.json          datos del proyecto + mapa de archivos
 *     LEEME.txt
 *     imagenes/                   biblioteca (admite subcarpetas propias)
 *     personajes/<Nombre>/
 *       ficha.txt
 *       cuerpo/ rostro/ ropa/ variantes/
 *     paginas/001_pagina.png …    (opcional)
 */
import { getAsset } from "../db";
import type { AssetMeta, CharacterImageCategory, Project } from "../types";
import { safeFileName } from "../utils";

export const MANIFEST_NAME = "proyecto.koma.json";
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

export const CATEGORY_FOLDERS: Record<CharacterImageCategory, string> = {
  body: "cuerpo",
  face: "rostro",
  outfit: "ropa",
  variant: "variantes",
};

export interface PackageManifest {
  app: "koma-studio";
  version: 1;
  packagedAt: string;
  project: Project;
  /** assetId → ruta relativa donde está su archivo. */
  assets: Record<string, string>;
  /** Todas las rutas que Koma escribió o importó (para detectar archivos nuevos). */
  files: string[];
}

export interface PackageProgress {
  phase: "images" | "pages" | "manifest";
  done: number;
  total: number;
}

// ── Utilidades de sistema de archivos ─────────────────────────

async function dirAt(root: FileSystemDirectoryHandle, parts: string[], create: boolean) {
  let dir = root;
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
  return dir;
}

async function writeFile(root: FileSystemDirectoryHandle, path: string, data: Blob | string, skipIfSameSize = false) {
  const parts = path.split("/");
  const dir = await dirAt(root, parts.slice(0, -1), true);
  const name = parts[parts.length - 1];
  if (skipIfSameSize && data instanceof Blob) {
    try {
      const existing = await (await dir.getFileHandle(name)).getFile();
      if (existing.size === data.size) return false;
    } catch {
      // no existe: se escribe
    }
  }
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
  return true;
}

export async function readManifest(root: FileSystemDirectoryHandle): Promise<PackageManifest | null> {
  try {
    const file = await (await root.getFileHandle(MANIFEST_NAME)).getFile();
    const data = JSON.parse(await file.text()) as PackageManifest;
    return data.app === "koma-studio" ? data : null;
  } catch {
    return null;
  }
}

function extFor(meta: AssetMeta) {
  const fromName = meta.name.match(IMAGE_EXT)?.[0]?.toLowerCase();
  if (fromName) return fromName === ".jpeg" ? ".jpg" : fromName;
  return meta.mime === "image/jpeg" ? ".jpg" : meta.mime === "image/webp" ? ".webp" : ".png";
}

const stem = (name: string) => name.replace(IMAGE_EXT, "");

/** Nombre de carpeta para un personaje ("Aiko Tanaka" → "Aiko_Tanaka"). */
export const characterFolder = (name: string) => safeFileName(name || "Sin_nombre");

// ── Plan de archivos ──────────────────────────────────────────

interface PlannedFile {
  path: string;
  assetId: string;
}

/**
 * Decide la ruta de cada imagen. Si el paquete anterior ya tenía una ruta para
 * ese asset dentro de la carpeta correcta, se conserva (no se duplican
 * archivos al volver a empaquetar).
 */
function planFiles(project: Project, assets: AssetMeta[], previous: PackageManifest | null): PlannedFile[] {
  const used = new Set<string>();
  const planned: PlannedFile[] = [];
  const metaById = new Map(assets.map((a) => [a.id, a]));

  const place = (assetId: string, dir: string, baseName: string) => {
    const meta = metaById.get(assetId);
    if (!meta) return;
    const prev = previous?.assets[assetId];
    if (prev && prev.startsWith(`${dir}/`) && !used.has(prev)) {
      used.add(prev);
      planned.push({ path: prev, assetId });
      return;
    }
    const ext = extFor(meta);
    const base = safeFileName(baseName) || "imagen";
    let path = `${dir}/${base}${ext}`;
    for (let n = 2; used.has(path); n++) path = `${dir}/${base}-${n}${ext}`;
    used.add(path);
    planned.push({ path, assetId });
  };

  assets
    .filter((a) => a.kind !== "character")
    .forEach((a) => {
      // Respeta subcarpetas que el usuario creó dentro de imagenes/.
      const prev = previous?.assets[a.id];
      const dir = prev?.startsWith("imagenes/") ? prev.split("/").slice(0, -1).join("/") : "imagenes";
      place(a.id, dir, stem(a.name));
    });

  project.characters.forEach((ch) => {
    ch.images.forEach((img) => {
      const meta = metaById.get(img.assetId);
      const dir = `personajes/${characterFolder(ch.name)}/${CATEGORY_FOLDERS[img.category]}`;
      place(img.assetId, dir, img.label || (meta ? stem(meta.name) : "referencia"));
    });
  });

  return planned;
}

function characterSheet(project: Project, characterId: string) {
  const ch = project.characters.find((c) => c.id === characterId)!;
  return [
    `Nombre: ${ch.name}`,
    `Rol: ${ch.role || "—"}`,
    "",
    "Descripción:",
    ch.description || "—",
    "",
  ].join("\n");
}

const README = `Paquete de Koma Studio
======================

Esta carpeta la genera el botón "Empaquetar" del editor.

- imagenes/     Imágenes de la biblioteca. Puedes añadir aquí (o en subcarpetas)
                las imágenes que descargues y usar "Importar imágenes nuevas".
- personajes/   Una carpeta por personaje con cuerpo/, rostro/, ropa/ y variantes/.
                Las imágenes que pongas en esas carpetas se añaden a su ficha.
                Una carpeta de personaje nueva crea un personaje nuevo.
- paginas/      Páginas renderizadas en PNG (si se incluyeron).
- ${MANIFEST_NAME}  Datos del proyecto. No lo edites a mano.
`;

// ── Escribir paquete ──────────────────────────────────────────

export interface WriteOptions {
  includePages: boolean;
  pageScale: 1 | 2 | 3;
}

export async function writePackage(
  root: FileSystemDirectoryHandle,
  project: Project,
  assets: AssetMeta[],
  options: WriteOptions,
  onProgress: (p: PackageProgress) => void,
): Promise<{ written: number; skipped: number; pages: number }> {
  const previous = await readManifest(root);
  const planned = planFiles(project, assets, previous);
  let written = 0;
  let skipped = 0;

  for (let i = 0; i < planned.length; i++) {
    onProgress({ phase: "images", done: i, total: planned.length });
    const asset = await getAsset(planned[i].assetId);
    if (!asset) continue;
    if (await writeFile(root, planned[i].path, asset.blob, true)) written++;
    else skipped++;
  }

  for (const ch of project.characters) {
    await writeFile(root, `personajes/${characterFolder(ch.name)}/ficha.txt`, characterSheet(project, ch.id));
    // Crear las 4 subcarpetas aunque estén vacías: así el usuario sabe dónde soltar.
    for (const folder of Object.values(CATEGORY_FOLDERS)) {
      await dirAt(root, ["personajes", characterFolder(ch.name), folder], true);
    }
  }
  await dirAt(root, ["imagenes"], true);

  let pages = 0;
  if (options.includePages && project.pages.length) {
    const { preparePages, renderPageCanvas } = await import("@/components/editor/export/render-page");
    const { canvasToBlob, pageFileName } = await import("../export");
    await preparePages(project.pages);
    for (let i = 0; i < project.pages.length; i++) {
      onProgress({ phase: "pages", done: i, total: project.pages.length });
      const canvas = await renderPageCanvas({ project, page: project.pages[i], index: i, pixelRatio: options.pageScale });
      const blob = await canvasToBlob(canvas, "image/png");
      canvas.width = canvas.height = 0;
      await writeFile(root, `paginas/${pageFileName(i, "png")}`, blob);
      pages++;
    }
  }

  onProgress({ phase: "manifest", done: 0, total: 1 });
  const manifest: PackageManifest = {
    app: "koma-studio",
    version: 1,
    packagedAt: new Date().toISOString(),
    project,
    assets: Object.fromEntries(planned.map((p) => [p.assetId, p.path])),
    files: [...new Set([...(previous?.files ?? []), ...planned.map((p) => p.path)])],
  };
  await writeFile(root, MANIFEST_NAME, JSON.stringify(manifest, null, 2));
  await writeFile(root, "LEEME.txt", README);

  return { written, skipped, pages };
}

// ── Detectar imágenes nuevas en la carpeta ───────────────────

export interface FoundFile {
  path: string;
  file: File;
}

export interface FolderScan {
  library: FoundFile[];
  /** carpeta de personaje → categoría → archivos */
  characters: Map<string, Map<CharacterImageCategory, FoundFile[]>>;
}

async function walkImages(dir: FileSystemDirectoryHandle, prefix: string, out: FoundFile[]) {
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith(".")) continue;
    const path = `${prefix}/${name}`;
    if (handle.kind === "directory") await walkImages(handle as FileSystemDirectoryHandle, path, out);
    else if (IMAGE_EXT.test(name)) out.push({ path, file: await (handle as FileSystemFileHandle).getFile() });
  }
}

const FOLDER_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_FOLDERS).map(([cat, folder]) => [folder, cat as CharacterImageCategory]),
);

/** Busca imágenes que todavía no forman parte del proyecto. */
export async function scanNewFiles(root: FileSystemDirectoryHandle): Promise<FolderScan> {
  const manifest = await readManifest(root);
  const known = new Set(manifest?.files ?? []);
  const scan: FolderScan = { library: [], characters: new Map() };

  try {
    const found: FoundFile[] = [];
    await walkImages(await root.getDirectoryHandle("imagenes"), "imagenes", found);
    scan.library = found.filter((f) => !known.has(f.path));
  } catch {
    // sin carpeta imagenes/
  }

  try {
    const charsDir = await root.getDirectoryHandle("personajes");
    for await (const [chName, chHandle] of charsDir.entries()) {
      if (chHandle.kind !== "directory" || chName.startsWith(".")) continue;
      for await (const [catName, catHandle] of (chHandle as FileSystemDirectoryHandle).entries()) {
        const category = FOLDER_TO_CATEGORY[catName.toLowerCase()];
        if (!category || catHandle.kind !== "directory") continue;
        const found: FoundFile[] = [];
        await walkImages(catHandle as FileSystemDirectoryHandle, `personajes/${chName}/${catName}`, found);
        const fresh = found.filter((f) => !known.has(f.path));
        if (!fresh.length) continue;
        const byCat = scan.characters.get(chName) ?? new Map<CharacterImageCategory, FoundFile[]>();
        byCat.set(category, fresh);
        scan.characters.set(chName, byCat);
      }
    }
  } catch {
    // sin carpeta personajes/
  }

  return scan;
}

/** Registra en el manifiesto los archivos ya importados para no repetirlos. */
export async function recordImported(
  root: FileSystemDirectoryHandle,
  project: Project,
  imported: Array<{ path: string; assetId: string }>,
) {
  const previous = await readManifest(root);
  const manifest: PackageManifest = {
    app: "koma-studio",
    version: 1,
    packagedAt: previous?.packagedAt ?? new Date().toISOString(),
    project,
    assets: { ...(previous?.assets ?? {}), ...Object.fromEntries(imported.map((i) => [i.assetId, i.path])) },
    files: [...new Set([...(previous?.files ?? []), ...imported.map((i) => i.path)])],
  };
  await writeFile(root, MANIFEST_NAME, JSON.stringify(manifest, null, 2));
}
