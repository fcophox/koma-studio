"use client";

import { ArrowLeftToLine, ArrowRightToLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, NumberInput, Segmented, TextInput } from "@/components/ui/Fields";
import { Modal } from "@/components/ui/Modal";
import { FORMAT_LIST } from "@/lib/formats";
import { useEditorStore } from "@/lib/store/editor-store";
import type { PageFormatId, ReadingDirection } from "@/lib/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/** Edición en vivo de la metadata: cada cambio se autoguarda. */
export function ProjectSettingsDialog({ isOpen, onClose }: Props) {
  const project = useEditorStore((s) => s.project);
  const updateMeta = useEditorStore((s) => s.updateMeta);
  const setReadingDirection = useEditorStore((s) => s.setReadingDirection);

  if (!project) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ajustes del proyecto"
      description="Los cambios se guardan automáticamente."
      footer={
        <Button variant="primary" onClick={onClose}>
          Listo
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Nombre de la obra / serie">
          {(id) => (
            <TextInput id={id} value={project.title} onChange={(e) => updateMeta({ title: e.target.value })} />
          )}
        </Field>

        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="Capítulo nº">
            {(id) => (
              <NumberInput
                id={id}
                min={0}
                value={project.chapterNumber}
                onChange={(v) => updateMeta({ chapterNumber: v })}
              />
            )}
          </Field>
          <Field label="Título del capítulo">
            {(id) => (
              <TextInput
                id={id}
                value={project.chapterTitle}
                onChange={(e) => updateMeta({ chapterTitle: e.target.value })}
              />
            )}
          </Field>
        </div>

        <Field
          label="Formato de página"
          hint="Las viñetas se reajustan a la nueva proporción; revisa el encuadre de las imágenes."
        >
          {(id) => (
            <select
              id={id}
              value={project.formatId}
              onChange={(e) => updateMeta({ formatId: e.target.value as PageFormatId })}
              className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm focus:border-accent focus:outline-none"
            >
              {FORMAT_LIST.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} — {f.description}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Dirección de lectura</span>
          <Segmented<ReadingDirection>
            value={project.readingDirection}
            onChange={setReadingDirection}
            options={[
              { value: "ltr", label: <><ArrowRightToLine className="size-3.5" /> Occidental (izq → der)</> },
              { value: "rtl", label: <><ArrowLeftToLine className="size-3.5" /> Manga (der → izq)</> },
            ]}
          />
          <p className="text-xs text-zinc-500">
            Al cambiarla se espejan las viñetas de todas las páginas para respetar el orden de lectura.
          </p>
        </div>
      </div>
    </Modal>
  );
}
