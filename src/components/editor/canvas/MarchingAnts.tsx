"use client";

import { useEffect, useRef } from "react";
import { Line } from "react-konva";
import Konva from "konva";

type Props = {
  points: number[];
  uiScale: number;
  color: string;
};

/** Borde punteado animado ("hormigas") para marcar lo copiado o cortado. */
export function MarchingAnts({ points, uiScale, color }: Props) {
  const ref = useRef<Konva.Line>(null);

  useEffect(() => {
    const line = ref.current;
    const layer = line?.getLayer();
    if (!line || !layer) return;
    const anim = new Konva.Animation((frame) => {
      if (frame) line.dashOffset(-(frame.time / 40) * uiScale);
    }, layer);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [uiScale]);

  return (
    <Line
      ref={ref}
      points={points}
      closed
      stroke={color}
      strokeWidth={2 * uiScale}
      dash={[7 * uiScale, 5 * uiScale]}
      listening={false}
    />
  );
}
