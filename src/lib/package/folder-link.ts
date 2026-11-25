"use client";

/**
 * Vínculo proyecto ↔ carpeta del disco. El handle que devuelve
 * showDirectoryPicker se puede guardar en IndexedDB y reutilizar en otra
 * sesión; el navegador solo vuelve a pedir permiso (con un clic del usuario).
 */
import { createStore, del, get, set, type UseStore } from "idb-keyval";

let store: UseStore | null = null;
const folders = () => (store ??= createStore("koma-folders", "handles"));

export function isFolderAccessSupported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function getLinkedFolder(projectId: string): Promise<FileSystemDirectoryHandle | null> {
  return (await get<FileSystemDirectoryHandle>(projectId, folders())) ?? null;
}

export async function linkFolder(projectId: string, handle: FileSystemDirectoryHandle) {
  await set(projectId, handle, folders());
}

export async function unlinkFolder(projectId: string) {
  await del(projectId, folders());
}

/** Comprueba o pide permiso de lectura/escritura. Llamar desde un clic. */
export async function ensureWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  if (!handle.queryPermission) return true;
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission?.(opts)) === "granted";
}

/**
 * Pide al usuario dónde guardar y crea (o reutiliza) la carpeta del proyecto
 * dentro de la ubicación elegida. Si elige directamente una carpeta que ya es
 * un paquete de Koma, se usa tal cual.
 */
export async function pickProjectFolder(folderName: string): Promise<FileSystemDirectoryHandle | null> {
  if (!window.showDirectoryPicker) return null;
  let parent: FileSystemDirectoryHandle;
  try {
    parent = await window.showDirectoryPicker({ id: "koma-package", mode: "readwrite", startIn: "documents" });
  } catch {
    return null; // el usuario canceló
  }
  try {
    await parent.getFileHandle("proyecto.koma.json");
    return parent;
  } catch {
    return parent.getDirectoryHandle(folderName, { create: true });
  }
}
