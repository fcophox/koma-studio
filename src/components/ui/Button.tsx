import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
};

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset]",
  secondary: "bg-surface-2 text-zinc-100 border border-line hover:bg-surface-3 hover:border-line-strong",
  ghost: "text-zinc-300 hover:bg-surface-3 hover:text-zinc-100",
  danger: "bg-red-500/10 text-red-300 border border-red-500/25 hover:bg-red-500/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
};

export function Button({ variant = "secondary", size = "md", icon, className, children, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  isActive?: boolean;
  size?: "sm" | "md";
};

/** Botón solo-icono: `label` se usa como aria-label y tooltip nativo. */
export function IconButton({ label, isActive, size = "md", className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors duration-150 hover:bg-surface-3 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30",
        size === "sm" ? "size-7" : "size-8",
        isActive && "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
