"use client";

import dynamic from "next/dynamic";

/** Konva necesita `window`: el lienzo se carga solo en cliente. */
const CanvasStage = dynamic(() => import("./CanvasStage").then((m) => m.CanvasStage), {
  ssr: false,
  loading: () => <div className="workspace-bg absolute inset-0" />,
});

export function EditorCanvas() {
  return <CanvasStage />;
}
