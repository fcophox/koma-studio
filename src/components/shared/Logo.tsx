import Link from "next/link";

export function Logo({ isCompact = false }: { isCompact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md" aria-label="Koma Studio — inicio">
      <span className="grid size-7 grid-cols-2 grid-rows-[3fr_2fr] gap-[2px] rounded-[5px] bg-accent p-[3px]" aria-hidden>
        <span className="col-span-2 rounded-[2px] bg-surface-0" />
        <span className="rounded-[2px] bg-surface-0" />
        <span className="rounded-[2px] bg-surface-0" />
      </span>
      {!isCompact && (
        <span className="text-sm font-semibold tracking-tight">
          Koma <span className="text-zinc-400">Studio</span>
        </span>
      )}
    </Link>
  );
}
