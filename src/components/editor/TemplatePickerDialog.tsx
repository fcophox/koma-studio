"use client";

import { Modal } from "@/components/ui/Modal";
import { getFormat } from "@/lib/formats";
import { useEditorStore } from "@/lib/store/editor-store";
import { TemplateGrid } from "./TemplateGrid";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onPick: (templateId: string) => void;
};

export function TemplatePickerDialog({ isOpen, onClose, onPick }: Props) {
  const project = useEditorStore((s) => s.project);
  if (!project) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva página"
      description="Elige una plantilla de viñetas. Podrás cambiarla después sin perder imágenes."
      className="w-[min(94vw,760px)]"
    >
      <TemplateGrid
        format={getFormat(project.formatId)}
        style={project.defaultStyle}
        direction={project.readingDirection}
        columns={6}
        onPick={(id) => {
          onPick(id);
          onClose();
        }}
      />
    </Modal>
  );
}

