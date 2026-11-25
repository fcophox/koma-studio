/**
 * Capa de persistencia local (IndexedDB vía idb-keyval).
 *
 * - `koma-projects`: un registro por proyecto (JSON sin binarios, ligero).
 * - `koma-assets`:   imágenes locales como Blob, referenciadas por id desde
 *   PlacedImage.assetId. Mantenerlas fuera del proyecto evita reescribir MBs
 *   de imágenes en cada autoguardado.
 *
 * idb-keyval usa un object store por base de datos, por eso son dos DBs.
 */
import { createStore, del, delMany, entries, get, set, setMany, type UseStore } from "idb-keyval";
import { clonePage, migrateProject, newId } from "./factory";
import type { Asset, AssetMeta, Project } from "./types";

let projectStore: UseStore | null = null;
let assetStore: UseStore | null = null;

function projects() {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB no disponible en este entorno");
  return (projectStore ??= createStore("koma-projects", "projects"));
}

function assets() {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB no disponible en este entorno");
  return (assetStore ??= createStore("koma-assets", "assets"));
}

// ── Proyectos ─────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const all = await entries<string, Project>(projects());
  return all.map(([, p]) => migrateProject(p)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | null> {
  const p = await get<Project>(id, projects());
  return p ? migrateProject(p) : null;
}

export async function saveProject(project: Project): Promise<void> {
  await set(project.id, project, projects());
}

export async function deleteProject(id: string): Promise<void> {
  const owned = await listAssetMeta(id);
  await delMany(owned.map((a) => a.id), assets());
  await del(id, projects());
}

/** Duplica el proyecto y sus imágenes (con IDs nuevos y referencias remapeadas). */
export async function duplicateProject(id: string): Promise<Project | null> {
  const source = await getProject(id);
  if (!source) return null;

  const now = Date.now();
  const copy: Project = {
    ...structuredClone(source),
    id: newId("pj_"),
    title: `${source.title} (copia)`,
    createdAt: now,
    updatedAt: now,
  };

  const sourceAssets = await listAssets(id);
  const idMap = new Map<string, string>();
  const newAssets: Array<[string, Asset]> = sourceAssets.map((a) => {
    const nid = newId("as_");
    idMap.set(a.id, nid);
    return [nid, { ...a, id: nid, projectId: copy.id }];
  });

  copy.pages = copy.pages.map((pg) => {
    const cloned = clonePage(pg);
    cloned.panels = cloned.panels.map((pn) =>
      pn.image ? { ...pn, image: { ...pn.image, assetId: idMap.get(pn.image.assetId) ?? pn.image.assetId } } : pn,
    );
    return cloned;
  });

  if (newAssets.length) await setMany(newAssets, assets());
  await saveProject(copy);
  return copy;
}

// ── Assets (imágenes locales) ────────────────────────────────

function readImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return createImageBitmap(blob).then((bmp) => {
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  });
}

export async function addAsset(projectId: string, file: File | Blob, name?: string): Promise<AssetMeta> {
  const { width, height } = await readImageSize(file);
  const asset: Asset = {
    id: newId("as_"),
    projectId,
    name: name ?? (file instanceof File ? file.name : "imagen"),
    mime: file.type || "image/png",
    width,
    height,
    size: file.size,
    blob: file,
    createdAt: Date.now(),
  };
  await set(asset.id, asset, assets());
  const { blob: _blob, ...meta } = asset;
  void _blob;
  return meta;
}

export async function getAsset(id: string): Promise<Asset | null> {
  return (await get<Asset>(id, assets())) ?? null;
}

export async function listAssets(projectId: string): Promise<Asset[]> {
  const all = await entries<string, Asset>(assets());
  return all
    .map(([, a]) => a)
    .filter((a) => a.projectId === projectId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function listAssetMeta(projectId: string): Promise<AssetMeta[]> {
  return (await listAssets(projectId)).map(({ blob: _blob, ...meta }) => {
    void _blob;
    return meta;
  });
}

export async function deleteAsset(id: string): Promise<void> {
  await del(id, assets());
}

// ── Caché de Object URLs ─────────────────────────────────────
// Konva y <img> necesitan URLs; se crean una vez por asset y se reutilizan.

const urlCache = new Map<string, Promise<string | null>>();

export function getAssetUrl(id: string): Promise<string | null> {
  let p = urlCache.get(id);
  if (!p) {
    p = getAsset(id).then((a) => (a ? URL.createObjectURL(a.blob) : null));
    urlCache.set(id, p);
  }
  return p;
}

export function revokeAssetUrls() {
  urlCache.forEach((p) => p.then((u) => u && URL.revokeObjectURL(u)));
  urlCache.clear();
}

export function revokeAssetUrl(id: string) {
  urlCache.get(id)?.then((u) => u && URL.revokeObjectURL(u));
  urlCache.delete(id);
}
