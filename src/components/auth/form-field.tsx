"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

interface FieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  /** Shown after the label for fields that may be left empty. */
  optionalLabel?: string;
  hint?: string;
  error?: string;
  /** For password fields: labels of the show/hide button. */
  reveal?: { show: string; hide: string };
}

/** A labelled input with its hint and error wired up for screen readers. */
export function FormField({ label, optionalLabel, hint, error, reveal, type, className, ...input }: FieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {optionalLabel && <span className="ml-1.5 font-normal text-muted">({optionalLabel})</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={reveal && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2",
            error ? "border-deal focus:ring-deal/25" : "border-line focus:border-brand focus:ring-brand/25",
            reveal && "pr-11",
          )}
          {...input}
        />
        {reveal && (
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? reveal.hide : reveal.show}
            className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-deal">
          {error}
        </p>
      )}
    </div>
  );
}

interface CheckProps extends Omit<ComponentProps<"input">, "id" | "type"> {
  label: string;
  error?: string;
}

export function CheckField({ label, error, ...input }: CheckProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 accent-brand"
          {...input}
        />
        {label}
      </label>
      {error && (
        <p id={`${id}-error`} className="ml-6.5 mt-1 text-xs font-medium text-deal">
          {error}
        </p>
      )}
    </div>
  );
}
