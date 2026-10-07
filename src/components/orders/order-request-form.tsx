"use client";

import Link from "next/link";
import { CircleCheck, Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import type { MarketConfig } from "@/config/markets";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { createOrderRequestAction, type OrderFormState } from "@/modules/orders/actions";
import { estimateAssistedOrder } from "@/modules/orders/pricing";
import type { LandedCostInput } from "@/modules/pricing/landed-cost";
import { FormField } from "@/components/auth/form-field";
import { Button, buttonClass } from "@/components/ui/button";

interface Props {
  offerId: string;
  productHref: string;
  /** What one unit costs, so the estimate can follow the quantity without a round trip. */
  unitCost: LandedCostInput;
  market: MarketConfig;
  /** Pre-filled from the account when the person is signed in. */
  defaults: { name: string; phone: string; email: string };
}

const INITIAL: OrderFormState = {};

export function OrderRequestForm({ offerId, productHref, unitCost, market, defaults }: Props) {
  const { t, money, locale } = useI18n();
  const [state, action, pending] = useActionState(createOrderRequestAction, INITIAL);
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState(defaults.phone);

  const estimate = estimateAssistedOrder(unitCost, market, quantity);
  const { maxQuantity } = market.assistedOrder;
  const error = (field: string) => (state.errors?.[field] ? t.order.errors[state.errors[field]] : undefined);

  if (state.reference) {
    return (
      <div className="rounded-2xl border border-brand bg-brand-soft p-6 text-center">
        <CircleCheck className="mx-auto size-10 text-brand" aria-hidden />
        <h2 className="mt-3 text-xl font-bold">{t.order.successTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/80">
          {fmt(t.order.successText, { phone, reference: state.reference })}
        </p>
        <Link href={productHref} className={buttonClass({ variant: "secondary" }, "mt-5")}>
          {t.order.backToProduct}
        </Link>
      </div>
    );
  }

  const stepper = "grid size-9 place-items-center rounded-full border border-line bg-surface hover:bg-surface-2 disabled:opacity-40";

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_20rem]" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="offerId" value={offerId} />
      <input type="hidden" name="quantity" value={estimate.quantity} />

      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-bold">{t.order.contactTitle}</h2>
        {state.formError && (
          <p role="alert" className="rounded-xl bg-deal-soft px-4 py-3 text-sm font-medium text-deal">
            {t.order.errors[state.formError]}
          </p>
        )}
        <FormField
          label={t.order.name}
          name="contactName"
          autoComplete="name"
          defaultValue={state.values?.contactName ?? defaults.name}
          error={error("contactName")}
          required
        />
        <FormField
          label={t.order.phone}
          name="contactPhone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+994"
          hint={t.order.phoneHint}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={error("contactPhone")}
          required
        />
        <FormField
          label={t.order.email}
          optionalLabel={t.order.optional}
          name="contactEmail"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.contactEmail ?? defaults.email}
          error={error("contactEmail")}
        />
        <FormField
          label={t.order.city}
          name="city"
          autoComplete="address-level2"
          defaultValue={state.values?.city}
          error={error("city")}
          required
        />
        <FormField
          label={t.order.note}
          optionalLabel={t.order.optional}
          name="note"
          maxLength={500}
          placeholder={t.order.notePlaceholder}
          defaultValue={state.values?.note}
          error={error("note")}
        />
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-36">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">{t.order.quantity}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={stepper}
              aria-label="−"
              disabled={quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <span className="w-6 text-center font-bold tabular-nums" aria-live="polite">
              {estimate.quantity}
            </span>
            <button
              type="button"
              className={stepper}
              aria-label="+"
              disabled={quantity >= maxQuantity}
              onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{t.order.estimateTitle}</h2>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t.order.lineGoods}</dt>
              <dd className="tabular-nums">{money(estimate.landed.totalMinor)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t.order.lineFee}</dt>
              <dd className="tabular-nums">{money(estimate.feeMinor)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-bold">
              <dt>{t.order.lineTotal}</dt>
              <dd className="tabular-nums">{money(estimate.totalMinor)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-5 text-muted">{t.order.estimateNote}</p>
        </div>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t.order.working : t.order.submit}
        </Button>
        <p className="text-center text-xs text-muted">{t.order.noPayment}</p>
      </aside>
    </form>
  );
}
