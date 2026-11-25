"use client";

import { useEffect } from "react";
import { Undo2, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";

const AUTO_HIDE_MS = 7000;

/** Aviso temporal con acción (p. ej. "Eliminaste la página 03 · Deshacer"). */
export function UndoToast() {
  const toast = useEditorStore((s) => s.toast);
  const dismiss = useEditorStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismiss, AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [toast, dismiss]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div
        role="status"
        aria-live="polite"
        key={toast.id}
        className="toast-in pointer-events-auto flex items-center gap-1 rounded-xl border border-line bg-surface-2 py-1.5 pr-1.5 pl-4 text-sm text-zinc-200 shadow-2xl shadow-black/60"
      >
        <span>{toast.message}</span>
        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              dismiss();
            }}
            className="ml-2 flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
          >
            <Undo2 className="size-3.5" />
            {toast.actionLabel}
            <kbd className="ml-1 text-[10px] font-normal text-zinc-500">⌘Z</kbd>
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso"
          className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-surface-3 hover:text-zinc-200"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
