"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextInput } from "@/components/ui/Fields";
import { Modal } from "@/components/ui/Modal";
import { CHARACTER_CATEGORIES, CHARACTER_COLORS, ROLE_SUGGESTIONS, characterAvatar, isAssetInUse } from "@/lib/characters";
import { newId } from "@/lib/factory";
import { useAssetImage } from "@/lib/hooks/use-asset-image";
import { ACCEPT_ATTR, useAssetStore } from "@/lib/store/asset-store";
import { useEditorStore } from "@/lib/store/editor-store";
import type { Character, CharacterImageCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CharacterAvatar } from "./CharacterAvatar";
import { CharacterImageTile } from "./CharacterImageTile";

type Props = {
  characterId: string | null;
  onClose: () => void;
};

const NEW_NAME = "Nuevo personaje";

/** Vista grande de una referencia. Esc la cierra sin cerrar la ficha. */
function Lightbox({ assetId, label, onClose }: { assetId: string; label: string; onClose: () => void }) {
  const image = useAssetImage(assetId);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-8 backdrop-blur-sm"
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- Object URL local
        <img src={image.src} alt={label} className="max-h-[82vh] max-w-full rounded-lg object-contain shadow-2xl" />
      )}
      {label && <p className="text-sm text-zinc-300">{label}</p>}
      <IconButton label="Cerrar vista (Esc)" onClick={onClose} className="absolute top-4 right-4 bg-black/60">
        <X className="size-4" />
      </IconButton>
    </div>
  );
}

function CategorySection({
  character,
  category,
  label,
  hint,
  onPreview,
}: {
  character: Character;
  category: CharacterImageCategory;
  label: string;
  hint: string;
  onPreview: (assetId: string, label: string) => void;
}) {
  const project = useEditorStore((s) => s.project);
  const addCharacterImages = useEditorStore((s) => s.addCharacterImages);
  const updateCharacterImage = useEditorStore((s) => s.updateCharacterImage);
  const removeCharacterImage = useEditorStore((s) => s.removeCharacterImage);
  const updateCharacter = useEditorStore((s) => s.updateCharacter);
  const importFiles = useAssetStore((s) => s.importFiles);
  const removeAsset = useAssetStore((s) => s.remove);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [pending, setPending] = useState(0);

  const images = character.images.filter((img) => img.category === category);
  const avatarId = characterAvatar(character);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setPending((n) => n + files.length);
    const added = await importFiles(files, "character");
    setPending((n) => Math.max(0, n - files.length));
    addCharacterImages(
      character.id,
      added.map((a) => ({ id: newId("ci_"), assetId: a.id, category, label: a.name.replace(/\.[^.]+$/, "") })),
    );
  };

  const handleRemove = (imageId: string, assetId: string) => {
    if (!project) return;
    const isUsedElsewhere = isAssetInUse(project, assetId, { characterId: character.id, imageId });
    removeCharacterImage(character.id, imageId);
    if (character.avatarAssetId === assetId) updateCharacter(character.id, { avatarAssetId: null });
    // El archivo solo se borra si ninguna viñeta ni otra ficha lo usa.
    if (!isUsedElsewhere) void removeAsset(assetId);
  };

  return (
    <section
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        void handleFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 transition-colors",
        isOver ? "border-accent bg-accent-soft" : "border-line bg-surface-2/40",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            {label} <span className="font-normal text-zinc-500 tabular-nums">· {images.length}</span>
          </h3>
          <p className="text-[11px] text-zinc-500">{hint}</p>
        </div>
        <Button
          size="sm"
          icon={pending ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          onClick={() => inputRef.current?.click()}
        >
          Añadir
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            void handleFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </header>

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-xs text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
        >
          Arrastra imágenes aquí o haz clic para elegirlas
        </button>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
          {images.map((img) => (
            <CharacterImageTile
              key={img.id}
              image={img}
              isAvatar={avatarId === img.assetId}
              onLabelChange={(value) => updateCharacterImage(character.id, img.id, { label: value })}
              onPreview={() => onPreview(img.assetId, img.label)}
              onMakeAvatar={() => updateCharacter(character.id, { avatarAssetId: img.assetId })}
              onRemove={() => handleRemove(img.id, img.assetId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Ficha completa: datos, descripción y sets de referencia por categoría. */
export function CharacterSheetDialog({ characterId, onClose }: Props) {
  const project = useEditorStore((s) => s.project);
  const updateCharacter = useEditorStore((s) => s.updateCharacter);
  const deleteCharacter = useEditorStore((s) => s.deleteCharacter);
  const removeAsset = useAssetStore((s) => s.remove);
  const [preview, setPreview] = useState<{ assetId: string; label: string } | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const character = project?.characters.find((ch) => ch.id === characterId) ?? null;

  const handleDelete = () => {
    if (!project || !character) return;
    const orphanAssets = [...new Set(character.images.map((i) => i.assetId))].filter(
      (assetId) => !isAssetInUse(project, assetId, { characterId: character.id }),
    );
    deleteCharacter(character.id);
    orphanAssets.forEach((id) => void removeAsset(id));
    setIsConfirmingDelete(false);
    onClose();
  };

  const update = (patch: Parameters<typeof updateCharacter>[1]) => character && updateCharacter(character.id, patch);
  const totalImages = character?.images.length ?? 0;

  return (
    <Modal
      isOpen={!!character}
      onClose={onClose}
      title={character?.name || "Personaje"}
      description="Ficha de personaje · los cambios se guardan automáticamente"
      className="w-[min(96vw,1100px)]"
      footer={
        <>
          <Button
            variant="danger"
            icon={<Trash2 className="size-3.5" />}
            onClick={() => setIsConfirmingDelete(true)}
            className="mr-auto"
          >
            Eliminar personaje
          </Button>
          <Button variant="primary" onClick={onClose}>
            Listo
          </Button>
        </>
      }
    >
      {character && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
          <aside className="flex flex-col gap-4">
            <CharacterAvatar character={character} className="aspect-square w-full rounded-2xl text-4xl" />

            <Field label="Nombre">
              {(id) => (
                <TextInput
                  id={id}
                  data-autofocus
                  value={character.name}
                  onFocus={(e) => character.name === NEW_NAME && e.currentTarget.select()}
                  onChange={(e) => update({ name: e.target.value })}
                />
              )}
            </Field>

            <Field label="Rol">
              {(id) => (
                <>
                  <TextInput
                    id={id}
                    list="character-roles"
                    placeholder="Protagonista, rival…"
                    value={character.role}
                    onChange={(e) => update({ role: e.target.value })}
                  />
                  <datalist id="character-roles">
                    {ROLE_SUGGESTIONS.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-zinc-400">Color</span>
              <div className="flex flex-wrap gap-1.5">
                {CHARACTER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    aria-pressed={character.color === c}
                    onClick={() => update({ color: c })}
                    className={cn(
                      "size-6 rounded-full ring-offset-2 ring-offset-surface-1 transition-shadow",
                      character.color === c ? "ring-2 ring-zinc-100" : "hover:ring-1 hover:ring-zinc-500",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <Field label="Descripción" hint="Personalidad, historia, rasgos físicos, forma de hablar…">
              {(id) => (
                <textarea
                  id={id}
                  rows={10}
                  value={character.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Ej. Estudiante de 17 años, tranquila pero testaruda. Cicatriz sobre la ceja izquierda; siempre lleva la bufanda roja de su hermano."
                  className="w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed placeholder:text-zinc-600 focus:border-accent focus:outline-none"
                />
              )}
            </Field>
            <p className="text-[11px] text-zinc-500 tabular-nums">{totalImages} referencias en total</p>
          </aside>

          <div className="flex min-w-0 flex-col gap-4">
            {CHARACTER_CATEGORIES.map((cat) => (
              <CategorySection
                key={cat.id}
                character={character}
                category={cat.id}
                label={cat.label}
                hint={cat.hint}
                onPreview={(assetId, label) => setPreview({ assetId, label })}
              />
            ))}
          </div>
        </div>
      )}

      {preview && <Lightbox assetId={preview.assetId} label={preview.label} onClose={() => setPreview(null)} />}

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title="¿Eliminar personaje?"
        message={`Se borrará la ficha de "${character?.name ?? ""}" y sus referencias. Las imágenes que estén colocadas en viñetas se conservan. No se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    </Modal>
  );
}
