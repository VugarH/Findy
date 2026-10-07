"use client";

import { useActionState, useId, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import type { AdminFormState } from "@/modules/admin/forms";
import { buttonClass } from "@/components/ui/button";
import { useAdminT } from "./admin-i18n";
import { NoticeBanner } from "./ui";

/** Form controls of the admin panel: a label, the control, a hint or an error. */

const controlClass = (error?: string) =>
  cn(
    "w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2",
    error ? "border-deal focus:ring-deal/25" : "border-line focus:border-brand focus:ring-brand/25",
  );

interface FieldFrame {
  label: ReactNode;
  hint?: ReactNode;
  /** An error key under `admin.errors`. */
  error?: string;
  optional?: boolean;
  className?: string;
}

function Frame({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: FieldFrame & { id: string; children: ReactNode }) {
  const t = useAdminT();
  const message = error ? (t.errors[error as keyof typeof t.errors] ?? t.errors.invalid) : null;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">({t.common.optional})</span>}
      </label>
      {children}
      {message ? (
        <p id={`${id}-message`} className="mt-1 text-xs font-medium text-deal">
          {message}
        </p>
      ) : (
        hint && (
          <p id={`${id}-message`} className="mt-1 text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  optional,
  className,
  ...input
}: FieldFrame & Omit<ComponentProps<"input">, "id">) {
  const id = useId();
  return (
    <Frame id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={cn(controlClass(error), "h-10")}
        {...input}
      />
    </Frame>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  className,
  ...input
}: FieldFrame & Omit<ComponentProps<"textarea">, "id">) {
  const id = useId();
  return (
    <Frame id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={cn(controlClass(error), "min-h-24 py-2")}
        {...input}
      />
    </Frame>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optional,
  className,
  options,
  ...select
}: FieldFrame & Omit<ComponentProps<"select">, "id"> & { options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <Frame id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={cn(controlClass(error), "h-10")}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Frame>
  );
}

export function CheckboxField({
  label,
  hint,
  className,
  ...input
}: { label: ReactNode; hint?: ReactNode; className?: string } & Omit<ComponentProps<"input">, "id" | "type">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand" {...input} />
        <span>
          {label}
          {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
      </label>
    </div>
  );
}

/** A submit button that shows it is working while its form's action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  confirm,
  className,
  ...button
}: Omit<ComponentProps<"button">, "type"> & {
  pendingLabel?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  /** Asks first, for changes that are hard to undo. */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      {...button}
      type="submit"
      disabled={pending || button.disabled}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className={buttonClass({ variant, size }, cn("rounded-lg", className))}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** The notice or form-wide error an action returned. */
export function FormMessage({ state }: { state: AdminFormState }) {
  const t = useAdminT();
  if (state.formError) {
    const text = t.errors[state.formError] ?? t.errors.unexpected;
    return <NoticeBanner tone="bad">{fmt(text, state.noticeVars ?? {})}</NoticeBanner>;
  }
  if (state.notice) return <NoticeBanner>{fmt(t.notices[state.notice], state.noticeVars ?? {})}</NoticeBanner>;
  return null;
}

/** Hidden inputs every admin form sends: the language (for redirects) and the record's id. */
export function HiddenFields({ values }: { values: Record<string, string | undefined> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) =>
        value === undefined ? null : <input key={name} type="hidden" name={name} value={value} />,
      )}
    </>
  );
}

type FormAction = (previous: AdminFormState, form: FormData) => Promise<AdminFormState>;

/**
 * useActionState for admin forms, plus a key that changes after every submit.
 * Put the key on the <form>: React resets a form after its action, and a
 * select would fall back to the value it was first rendered with; re-mounting
 * shows what was saved (or, after an error, what was typed).
 */
export function useAdminForm(action: FormAction, onResult?: (result: AdminFormState) => void) {
  const [state, formAction] = useActionState<AdminFormState & { round?: number }, FormData>(async (previous, form) => {
    const result = await action(previous, form);
    onResult?.(result);
    return { ...result, round: (previous.round ?? 0) + 1 };
  }, {});
  return [state, formAction, state.round ?? 0] as const;
}
