"use client";

import { Check, Package } from "lucide-react";
import { useActionState } from "react";
import { useI18n } from "@/i18n/client";
import { startConversationAction, type MessageFormState } from "@/modules/messages/actions";
import { MAX_MESSAGE_LENGTH } from "@/modules/messages/rules";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const INITIAL: MessageFormState = {};

interface Props {
  /** The product the person came from, if any. */
  product: { slug: string; title: string } | null;
  /** From the account, so most people need not type it. */
  defaultPhone: string;
}

/** The first message of a conversation: what to buy (links pasted in the text) and, optionally, a phone number. */
export function NewMessageForm({ product, defaultPhone }: Props) {
  const { t, locale } = useI18n();
  const m = t.messages;
  const [state, action, pending] = useActionState(startConversationAction, INITIAL);
  const bodyError = state.error && state.error !== "phoneInvalid" ? m.errors[state.error] : undefined;

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {product && <input type="hidden" name="product" value={product.slug} />}

      <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
        {product && (
          <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
            <Package className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="text-muted">{m.about}:</span>
            <span className="min-w-0 truncate font-semibold">{product.title}</span>
          </p>
        )}

        <div>
          <label htmlFor="new-message-body" className="mb-1.5 block text-sm font-semibold text-ink">
            {m.bodyLabel}
          </label>
          <textarea
            id="new-message-body"
            name="body"
            rows={7}
            required
            maxLength={MAX_MESSAGE_LENGTH}
            defaultValue={state.values?.body}
            placeholder={m.bodyPlaceholder}
            aria-invalid={bodyError ? true : undefined}
            aria-describedby={bodyError ? "new-message-error" : undefined}
            className={cn(
              "block w-full resize-y rounded-xl border bg-surface px-3.5 py-3 text-sm leading-6 text-ink placeholder:text-muted focus:outline-none focus:ring-2",
              bodyError ? "border-deal focus:ring-deal/25" : "border-line focus:border-brand focus:ring-brand/25",
            )}
          />
          {bodyError && (
            <p id="new-message-error" role="alert" className="mt-1.5 text-xs font-medium text-deal">
              {bodyError}
            </p>
          )}
        </div>

        <FormField
          label={m.phoneLabel}
          optionalLabel={m.optional}
          name="contactPhone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+994"
          hint={m.phoneHint}
          defaultValue={state.values?.contactPhone ?? defaultPhone}
          error={state.error === "phoneInvalid" ? m.errors.phoneInvalid : undefined}
          className="max-w-sm"
        />

        <Button type="submit" disabled={pending}>
          {pending ? m.sending : m.send}
        </Button>
      </div>

      <aside className="h-fit rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-bold">{m.tipsTitle}</h2>
        <ul className="mt-3 space-y-2.5">
          {[m.tip1, m.tip2, m.tip3].map((tip) => (
            <li key={tip} className="flex items-start gap-2.5 text-sm leading-6 text-muted">
              <Check className="mt-1 size-4 shrink-0 text-brand" aria-hidden />
              {tip}
            </li>
          ))}
        </ul>
      </aside>
    </form>
  );
}
