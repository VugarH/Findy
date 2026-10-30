"use client";

import { useRef, type ReactNode } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";
import { useAdminT } from "./admin-i18n";
import { HiddenFields, SubmitButton, TextAreaField } from "./fields";

/**
 * Asks why before a store goes off (the note is optional), and changes the
 * note later. A native dialog: it opens above everything, also inside a table.
 */
export function StoreOffDialog({
  action,
  fields,
  reason,
  title,
  submit,
  children,
  variant = "ghost",
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  reason?: string | null;
  title: string;
  submit: string;
  /** The button that opens it. */
  children: ReactNode;
  variant?: "secondary" | "ghost";
}) {
  const t = useAdminT();
  const { locale } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={cn(buttonClass({ variant, size: "sm" }), "h-8 px-3 text-xs")}
      >
        {children}
      </button>
      <dialog
        ref={dialog}
        aria-label={title}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-left text-ink shadow-card backdrop:bg-black/50"
      >
        <form action={action} onSubmit={() => dialog.current?.close()} className="space-y-4">
          <HiddenFields values={{ ...fields, locale }} />
          <h2 className="text-lg font-bold">{title}</h2>
          <TextAreaField
            label={t.stores.off.reason}
            name="reason"
            defaultValue={reason ?? ""}
            optional
            rows={3}
            maxLength={500}
            hint={t.stores.off.reasonHint}
            placeholder={t.stores.off.reasonPlaceholder}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className={buttonClass({ variant: "ghost", size: "sm" })}>
              {t.stores.off.cancel}
            </button>
            <SubmitButton size="sm">{submit}</SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
