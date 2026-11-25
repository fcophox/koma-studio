import type { PageFormat, PageFormatId } from "./types";

/** 4 u por mm → exportar a 3x ≈ 305 DPI (calidad de imprenta). */
export const PX_PER_MM = 4;

const mm = (v: number) => Math.round(v * PX_PER_MM);

export const PAGE_FORMATS: Record<PageFormatId, PageFormat> = {
  "manga-b5": {
    id: "manga-b5",
    label: "Manga B5",
    description: "182 × 257 mm · tankōbon japonés",
    widthMm: 182,
    heightMm: 257,
    width: mm(182),
    height: mm(257),
  },
  "us-comic": {
    id: "us-comic",
    label: "Cómic americano",
    description: "170 × 260 mm · comic book estándar",
    widthMm: 170,
    heightMm: 260,
    width: mm(170),
    height: mm(260),
  },
  a4: {
    id: "a4",
    label: "A4",
    description: "210 × 297 mm · europeo / bande dessinée",
    widthMm: 210,
    heightMm: 297,
    width: mm(210),
    height: mm(297),
  },
  webtoon: {
    id: "webtoon",
    label: "Webtoon vertical",
    description: "800 × 2400 px · lectura con scroll",
    widthMm: null,
    heightMm: null,
    width: 800,
    height: 2400,
  },
};

export const FORMAT_LIST = Object.values(PAGE_FORMATS);

export function getFormat(id: PageFormatId): PageFormat {
  return PAGE_FORMATS[id] ?? PAGE_FORMATS["manga-b5"];
}
