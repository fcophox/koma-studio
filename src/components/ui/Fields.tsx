"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const inputBase =
  "h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors hover:border-line-strong focus:border-accent focus:outline-none";

type FieldProps = {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
  className?: string;
};

export function Field({ label, hint, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium text-zinc-400">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={cn(inputBase, className)} {...rest} />;
}

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: number;
  onChange: (value: number) => void;
};

export function NumberInput({ value, onChange, className, min, max, ...rest }: NumberInputProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={Number.isFinite(value) ? value : ""}
      min={min}
      max={max}
      onChange={(e) => {
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n)) onChange(n);
      }}
      className={cn(inputBase, "tabular-nums", className)}
      {...rest}
    />
  );
}

type SliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
};

export function SliderRow({ label, value, min, max, step = 1, unit = "", onChange }: SliderRowProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs text-zinc-400">
          {label}
        </label>
        <span className="text-xs text-zinc-300 tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="range w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
    </div>
  );
}

type ColorRowProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function ColorRow({ label, value, onChange }: ColorRowProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-xs text-zinc-400">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-zinc-500 uppercase">{value}</span>
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
        />
      </div>
    </div>
  );
}

type ToggleProps = {
  label: string;
  isChecked: boolean;
  onChange: (value: boolean) => void;
};

export function Toggle({ label, isChecked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      onClick={() => onChange(!isChecked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-xs text-zinc-400">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors duration-200",
          isChecked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200",
            isChecked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

type SegmentedProps<T extends string> = {
  value: T;
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  onChange: (value: T) => void;
  className?: string;
};

export function Segmented<T extends string>({ value, options, onChange, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" className={cn("flex rounded-lg border border-line bg-surface-2 p-0.5", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
            value === opt.value ? "bg-surface-3 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
