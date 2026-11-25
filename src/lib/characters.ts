import type { Character, CharacterImageCategory, Project } from "./types";

export const CHARACTER_CATEGORIES: Array<{ id: CharacterImageCategory; label: string; hint: string }> = [
  { id: "body", label: "Cuerpo", hint: "Turnaround, proporciones, poses" },
  { id: "face", label: "Rostro", hint: "Expresiones y ángulos de la cara" },
  { id: "outfit", label: "Ropa", hint: "Vestuario y accesorios" },
  { id: "variant", label: "Variantes", hint: "Edades, transformaciones, versiones alternativas" },
];

export const CHARACTER_COLORS = ["#ff5a36", "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#94a3b8"];

export const ROLE_SUGGESTIONS = ["Protagonista", "Antagonista", "Secundario", "Mentor", "Rival", "Interés amoroso", "Extra"];

/** Avatar del personaje: el elegido, o el primer rostro, o la primera imagen. */
export function characterAvatar(ch: Character): string | null {
  if (ch.avatarAssetId && ch.images.some((i) => i.assetId === ch.avatarAssetId)) return ch.avatarAssetId;
  return (ch.images.find((i) => i.category === "face") ?? ch.images[0])?.assetId ?? null;
}

/** ¿Algún panel o ficha (salvo la excluida) usa este asset? Evita borrar imágenes en uso. */
export function isAssetInUse(project: Project, assetId: string, except?: { characterId: string; imageId?: string }) {
  const inPanels = project.pages.some((pg) => pg.panels.some((pn) => pn.image?.assetId === assetId));
  if (inPanels) return true;
  return project.characters.some((ch) =>
    ch.images.some(
      (img) =>
        img.assetId === assetId &&
        !(except && ch.id === except.characterId && (except.imageId === undefined || img.id === except.imageId)),
    ),
  );
}
