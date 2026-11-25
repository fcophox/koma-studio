export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** "01", "02"… a partir del índice y el número inicial del capítulo. */
export function pageNumber(index: number, startAt: number) {
  return startAt + index;
}

export function formatPageNumber(n: number, pad = 2) {
  return String(n).padStart(pad, "0");
}

export function formatChapter(chapterNumber: number, chapterTitle?: string) {
  const num = `Capítulo ${formatPageNumber(chapterNumber)}`;
  return chapterTitle ? `${num}: ${chapterTitle}` : num;
}

/** Nombre de archivo seguro: "Mi Obra!" → "Mi_Obra". */
export function safeFileName(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "_") || "proyecto"
  );
}

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

export function relativeTime(ts: number) {
  const diff = (ts - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "hace un momento";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(ts).toLocaleDateString("es");
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
