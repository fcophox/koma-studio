"use client";

import { useState } from "react";
import { ArrowLeftToLine, ArrowRightToLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, NumberInput, Segmented, TextInput } from "@/components/ui/Fields";
import { Modal } from "@/components/ui/Modal";
import type { NewProjectInput } from "@/lib/factory";
import { FORMAT_LIST } from "@/lib/formats";
import type { PageFormatId, ReadingDirection } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: NewProjectInput) => void;
};

const INITIAL: NewProjectInput = {
  title: "",
  chapterNumber: 1,
  chapterTitle: "",
  formatId: "manga-b5",
  readingDirection: "rtl",
  initialPages: 4,
};

export function NewProjectDialog({ isOpen, onClose, onCreate }: Props) {
  const [form, setForm] = useState<NewProjectInput>(INITIAL);

  const update = <K extends keyof NewProjectInput>(key: K, value: NewProjectInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(form);
    setForm(INITIAL);
  };

  const handleFormatChange = (id: PageFormatId) => {
    // Sugerir la dirección de lectura natural del formato elegido.
    setForm((f) => ({ ...f, formatId: id, readingDirection: id === "manga-b5" ? "rtl" : "ltr" }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo proyecto"
      description="Se guarda solo en este navegador (IndexedDB)."
      className="w-[min(94vw,640px)]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="new-project-form">
            Crear y abrir
          </Button>
        </>
      }
    >
      <form id="new-project-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="Nombre de la obra / serie">
          {(id) => (
            <TextInput
              id={id}
              data-autofocus
              required
              placeholder="Ej. Kage no Hana"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          )}
        </Field>

        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="Capítulo nº">
            {(id) => (
              <NumberInput id={id} min={0} value={form.chapterNumber} onChange={(v) => update("chapterNumber", v)} />
            )}
          </Field>
          <Field label="Título del capítulo">
            {(id) => (
              <TextInput
                id={id}
                placeholder="El inicio"
                value={form.chapterTitle}
                onChange={(e) => update("chapterTitle", e.target.value)}
              />
            )}
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-xs font-medium text-zinc-400">Formato de página</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FORMAT_LIST.map((fmt) => {
              const isSelected = form.formatId === fmt.id;
              const ratio = fmt.height / fmt.width;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleFormatChange(fmt.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
                    isSelected
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-surface-2 hover:border-line-strong",
                  )}
                >
                  <span className="flex h-14 items-end">
                    <span
                      className={cn("block rounded-[2px] border", isSelected ? "border-accent bg-white" : "border-zinc-500 bg-zinc-200")}
                      style={{ width: Math.min(40, 56 / ratio), height: Math.min(56, 40 * ratio) }}
                    />
                  </span>
                  <span className="text-xs font-semibold">{fmt.label}</span>
                  <span className="text-[10px] leading-tight text-zinc-500">{fmt.description}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-zinc-400">Dirección de lectura</span>
            <Segmented<ReadingDirection>
              value={form.readingDirection}
              onChange={(v) => update("readingDirection", v)}
              options={[
                { value: "ltr", label: <><ArrowRightToLine className="size-3.5" /> Occidental</>, title: "Izquierda a derecha" },
                { value: "rtl", label: <><ArrowLeftToLine className="size-3.5" /> Manga</>, title: "Derecha a izquierda" },
              ]}
            />
          </div>
          <Field label="Páginas iniciales">
            {(id) => (
              <NumberInput
                id={id}
                min={1}
                max={60}
                value={form.initialPages ?? 1}
                onChange={(v) => update("initialPages", Math.min(60, Math.max(1, Math.round(v))))}
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
