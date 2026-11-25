"use client";

import { Button } from "./Button";
import { Modal } from "./Modal";

type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ isOpen, title, message, confirmLabel = "Eliminar", onConfirm, onCancel }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      className="w-[min(92vw,420px)]"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-zinc-300">{message}</p>
    </Modal>
  );
}
