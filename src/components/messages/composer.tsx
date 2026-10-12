"use client";

import { SendHorizontal } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props {
  action: (form: FormData) => void;
  pending: boolean;
  /** Hidden fields sent along, e.g. the conversation id. */
  fields: Record<string, string>;
  label: string;
  placeholder: string;
  sendLabel: string;
  hint: string;
  error?: string;
  /** Typed text to put back after a failed send. */
  defaultValue?: string;
  maxLength: number;
  children?: ReactNode;
}

/**
 * The reply box under a conversation. Ctrl/Cmd + Enter sends; the parent
 * remounts it (key) after a successful send, which empties it.
 */
export function Composer({ action, pending, fields, label, placeholder, sendLabel, hint, error, defaultValue, maxLength, children }: Props) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={action} className="rounded-2xl border border-line bg-surface p-3">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="sr-only" htmlFor="message-body">
        {label}
      </label>
      <textarea
        id="message-body"
        name="body"
        rows={3}
        required
        maxLength={maxLength}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            form.current?.requestSubmit();
          }
        }}
        className={cn(
          "block w-full resize-y rounded-xl border bg-bg px-3.5 py-2.5 text-sm leading-6 text-ink placeholder:text-muted focus:outline-none focus:ring-2",
          error ? "border-deal focus:ring-deal/25" : "border-line focus:border-brand focus:ring-brand/25",
        )}
      />
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-deal">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="hidden text-xs text-muted sm:block">{hint}</p>
        <div className="ml-auto flex items-center gap-2">
          {children}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-strong disabled:opacity-60"
          >
            <SendHorizontal className="size-4" aria-hidden />
            {sendLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
