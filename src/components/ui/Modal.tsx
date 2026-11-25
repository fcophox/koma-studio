"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./Button";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Modal sobre <dialog> nativo: foco atrapado, Escape y capa superior gratis.
 */
export function Modal({ isOpen, onClose, title, description, children, footer, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      // autoFocus de React corre antes de showModal(); se enfoca aquí.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      aria-labelledby="modal-title"
      className={cn(
        "m-auto w-[min(92vw,560px)] rounded-2xl border border-line bg-surface-1 p-0 text-zinc-100 shadow-2xl shadow-black/60",
        className,
      )}
    >
      {isOpen && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 pt-5 pb-4">
            <div>
              <h2 id="modal-title" className="text-base font-semibold tracking-tight">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
            </div>
            <IconButton label="Cerrar" onClick={onClose} className="-mr-2">
              <X className="size-4" />
            </IconButton>
          </header>
          <div className="scroll-thin overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
