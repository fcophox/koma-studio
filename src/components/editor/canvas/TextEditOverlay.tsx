"use client";

import type { CSSProperties } from "react";
import { bubbleTextBox } from "@/lib/bubbles";
import { resolveFont } from "@/lib/fonts";
import type { CanvasElement } from "@/lib/types";

type Props = {
  element: CanvasElement;
  view: { scale: number; x: number; y: number };
  onChange: (text: string) => void;
  onDone: () => void;
};

/**
 * Edición de texto directamente sobre el lienzo: un <textarea> HTML colocado
 * y transformado exactamente encima del elemento (Konva no tiene inputs).
 */
export function TextEditOverlay({ element: el, view, onChange, onDone }: Props) {
  const s = view.scale;
  const isBubble = el.type === "bubble";
  const box = isBubble ? bubbleTextBox(el.kind, el.width, el.height) : null;

  const style: CSSProperties & { fieldSizing?: string } = {
    left: view.x + el.x * s,
    top: view.y + el.y * s,
    transform: `translate(-50%, -50%) rotate(${el.rotation}deg) scale(${el.scaleX}, ${el.scaleY})`,
    width: box ? box.width * s : undefined,
    minWidth: box ? undefined : 40,
    font: `${el.fontStyle} ${el.fontSize * s}px ${resolveFont(el.fontFamily)}`,
    lineHeight: isBubble ? el.lineHeight : el.vertical ? 0.92 : 1,
    textAlign: isBubble ? el.align : "center",
    color: isBubble ? el.textColor : el.fill,
    fieldSizing: "content",
  };

  if (!isBubble) {
    style.letterSpacing = el.letterSpacing * s;
    style.WebkitTextStroke = `${el.strokeWidth * s}px ${el.stroke}`;
    style.paintOrder = "stroke fill";
    if (el.vertical) {
      style.writingMode = "vertical-rl";
      style.textOrientation = "upright";
    }
  }

  return (
    <textarea
      aria-label="Editar texto"
      autoFocus
      value={el.text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          onDone();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      spellCheck={false}
      className="absolute z-10 resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 outline-1 outline-offset-4 outline-accent outline-dashed"
      style={style}
    />
  );
}
