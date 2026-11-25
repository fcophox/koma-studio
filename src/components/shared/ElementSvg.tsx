import { bubbleGeometry, bubbleTextBox } from "@/lib/bubbles";
import { resolveFont } from "@/lib/fonts";
import type { BubbleKind, CanvasElement, OnomatopoeiaElement, SpeechBubble } from "@/lib/types";

function fontAttrs(fontStyle: string) {
  return {
    fontWeight: fontStyle.includes("bold") ? 700 : 400,
    fontStyle: fontStyle.includes("italic") ? "italic" : "normal",
  };
}

/** Cuerpo + cola de un globo en SVG (misma geometría que el lienzo). */
export function BubbleShapeSvg({ bubble }: { bubble: Pick<SpeechBubble, "id" | "kind" | "width" | "height" | "tail" | "strokeWidth" | "stroke" | "fill"> }) {
  const geo = bubbleGeometry(bubble);
  return (
    <g>
      {bubble.strokeWidth > 0 &&
        geo.paths.map((d, i) => (
          <path
            key={`s${i}`}
            d={d}
            fill="none"
            stroke={bubble.stroke}
            strokeWidth={bubble.strokeWidth * 2}
            strokeLinejoin={geo.lineJoin}
            strokeDasharray={geo.dash?.join(" ")}
          />
        ))}
      {geo.paths.map((d, i) => (
        <path key={`f${i}`} d={d} fill={bubble.fill} />
      ))}
    </g>
  );
}

/** Ajuste de línea aproximado (solo para miniaturas, donde no se lee el texto). */
function roughWrap(text: string, maxWidth: number, fontSize: number) {
  const charW = fontSize * 0.52;
  const maxChars = Math.max(4, Math.floor(maxWidth / charW));
  return text.split("\n").flatMap((para) => {
    const lines: string[] = [];
    let line = "";
    para.split(/\s+/).forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else line = next;
    });
    lines.push(line);
    return lines;
  });
}

function BubbleSvg({ el }: { el: SpeechBubble }) {
  const box = bubbleTextBox(el.kind, el.width, el.height);
  const lines = roughWrap(el.text, box.width, el.fontSize);
  const lh = el.fontSize * el.lineHeight;
  const anchor = el.align === "left" ? "start" : el.align === "right" ? "end" : "middle";
  const tx = el.align === "left" ? -box.width / 2 : el.align === "right" ? box.width / 2 : 0;
  return (
    <>
      <BubbleShapeSvg bubble={el} />
      <text
        textAnchor={anchor}
        fontFamily={resolveFont(el.fontFamily)}
        fontSize={el.fontSize}
        fill={el.textColor}
        {...fontAttrs(el.fontStyle)}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={tx} y={(i - (lines.length - 1) / 2) * lh} dominantBaseline="central">
            {line}
          </tspan>
        ))}
      </text>
    </>
  );
}

function SfxSvg({ el }: { el: OnomatopoeiaElement }) {
  const lines = el.vertical ? Array.from(el.text.replace(/\n/g, "")) : el.text.split("\n");
  const lh = el.fontSize * (el.vertical ? 0.92 : 1);
  return (
    <text
      textAnchor="middle"
      fontFamily={resolveFont(el.fontFamily)}
      fontSize={el.fontSize}
      letterSpacing={el.letterSpacing}
      fill={el.fill}
      stroke={el.stroke}
      strokeWidth={el.strokeWidth}
      strokeLinejoin="round"
      paintOrder="stroke"
      transform={`matrix(1 0 ${el.skewX} 1 0 0)`}
      {...fontAttrs(el.fontStyle)}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={0} y={(i - (lines.length - 1) / 2) * lh} dominantBaseline="central">
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** Un elemento libre posicionado en coordenadas de página (para miniaturas). */
export function ElementSvg({ el }: { el: CanvasElement }) {
  return (
    <g transform={`translate(${el.x} ${el.y}) rotate(${el.rotation}) scale(${el.scaleX} ${el.scaleY})`}>
      {el.type === "bubble" ? <BubbleSvg el={el} /> : <SfxSvg el={el} />}
    </g>
  );
}

/** Icono del catálogo para cada tipo de globo. */
export function BubbleGlyph({ kind, className }: { kind: BubbleKind; className?: string }) {
  const isNarration = kind === "narration";
  const bubble = {
    id: `glyph-${kind}`,
    kind,
    width: isNarration ? 150 : 130,
    height: isNarration ? 58 : 84,
    strokeWidth: 3.5,
    stroke: "#111111",
    fill: isNarration ? "#fff8dc" : "#ffffff",
    tail: { enabled: !isNarration, tipX: -42, tipY: 66 },
  };
  return (
    <svg viewBox="-90 -60 180 140" className={className} aria-hidden>
      <BubbleShapeSvg bubble={bubble} />
    </svg>
  );
}
