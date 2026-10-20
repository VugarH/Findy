"use client";

import { Check, Loader2, Package, ShoppingBag, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import type { CategorySlug } from "@/config/categories";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { CartItem } from "@/modules/cart/items";
import type { CartView, Parcel } from "@/modules/cart/plan";
import { priceRequestItemsAction, startConversationAction, type MessageFormState } from "@/modules/messages/actions";
import { MAX_MESSAGE_LENGTH } from "@/modules/messages/rules";
import { FormField } from "@/components/auth/form-field";
import { useCartItems } from "@/components/cart/cart-store";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const INITIAL: MessageFormState = {};

interface Props {
  /** Already attached, e.g. the item the person came from ("Order with our help"). */
  initialItems: CartItem[];
  /** Open the cart panel at once (from the cart page). */
  openCart: boolean;
  /** From the account, so most people need not type it. */
  defaultPhone: string;
}

type Priced = { view: CartView; feeMinor: number };

/** Prices a list of offers on the server; null while it loads. */
function usePriced(items: CartItem[]): Priced | null {
  const key = JSON.stringify(items);
  const [result, setResult] = useState<{ key: string; value: Priced } | null>(null);
  useEffect(() => {
    if (items.length === 0) return;
    let live = true;
    priceRequestItemsAction(items).then((value) => live && setResult({ key, value }));
    return () => {
      live = false;
    };
    // `key` stands for `items`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (items.length === 0) return { view: { parcels: [], totalMinor: 0, itemCount: 0, customsMinor: 0, savingsMinor: 0, delivery: null, unavailable: [], unknown: [] }, feeMinor: 0 };
  return result?.key === key ? result.value : null;
}

/**
 * A new request: items to buy (attached from a product page or picked from the
 * cart's parcels), a message, and how to reach the person. The items are sent
 * as offer ids and quantities; the server prices them again.
 */
export function NewMessageForm({ initialItems, openCart, defaultPhone }: Props) {
  const { t, locale, money } = useI18n();
  const m = t.messages;
  const [state, action, pending] = useActionState(startConversationAction, INITIAL);
  const [attached, setAttached] = useState<CartItem[]>(() => {
    try {
      return state.values?.items ? (JSON.parse(state.values.items) as CartItem[]) : initialItems;
    } catch {
      return initialItems;
    }
  });
  const [panelOpen, setPanelOpen] = useState(openCart);
  const cartItems = useCartItems();
  const priced = usePriced(attached);
  const bodyError = state.error && state.error !== "phoneInvalid" && state.error !== "cityLong" ? m.errors[state.error] : undefined;

  const remove = (offerId: string) => setAttached((items) => items.filter((item) => item.offerId !== offerId));
  const add = (lines: CartItem[]) =>
    setAttached((items) => {
      const next = [...items];
      for (const line of lines) {
        const index = next.findIndex((item) => item.offerId === line.offerId);
        if (index === -1) next.push(line);
        else next[index] = line;
      }
      return next;
    });

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="items" value={JSON.stringify(attached)} />

      <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">{m.itemsTitle}</h2>
            {cartItems.length > 0 && !panelOpen && (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
              >
                <ShoppingBag className="size-4" aria-hidden />
                {m.addFromCart}
              </button>
            )}
          </div>

          {panelOpen && (
            <CartPanel
              cartItems={cartItems}
              preselect={openCart}
              onAdd={(lines) => {
                add(lines);
                setPanelOpen(false);
              }}
              onCancel={() => setPanelOpen(false)}
            />
          )}

          {attached.length > 0 &&
            (priced ? (
              <AttachedItems priced={priced} onRemove={remove} />
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {m.loadingItems}
              </p>
            ))}
          {attached.length === 0 && !panelOpen && (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3.5 py-3 text-sm text-muted">
              <Package className="size-4 shrink-0" aria-hidden />
              {m.tip1}
            </p>
          )}
        </section>

        <div>
          <label htmlFor="new-message-body" className="mb-1.5 block text-sm font-semibold text-ink">
            {m.bodyLabel}
            {attached.length > 0 && <span className="ml-1.5 font-normal text-muted">({m.optional})</span>}
          </label>
          <textarea
            id="new-message-body"
            name="body"
            rows={5}
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

        <div className="grid gap-4 sm:grid-cols-2">
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
          />
          <FormField
            label={m.cityLabel}
            optionalLabel={m.optional}
            name="city"
            autoComplete="address-level2"
            hint={m.cityHint}
            maxLength={80}
            defaultValue={state.values?.city}
            error={state.error === "cityLong" ? m.errors.cityLong : undefined}
          />
        </div>

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
        {attached.length > 0 && priced && priced.view.parcels.length > 0 && (
          <div className="mt-4 border-t border-line pt-4 text-sm">
            <p className="flex justify-between font-bold">
              <span>{m.estimatedTotal}</span>
              <span className="tabular-nums">{money(priced.view.totalMinor)}</span>
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted">{fmt(m.feeNote, { fee: money(priced.feeMinor) })}</p>
          </div>
        )}
      </aside>
    </form>
  );
}

/** The attached items, parcel by parcel, each removable. */
function AttachedItems({ priced, onRemove }: { priced: Priced; onRemove: (offerId: string) => void }) {
  const { t, money } = useI18n();
  const m = t.messages;
  return (
    <div className="space-y-3">
      {priced.view.parcels.map((parcel) => (
        <div key={parcel.store.id} className="rounded-xl border border-line">
          <p className="flex items-baseline justify-between gap-3 border-b border-line bg-surface-2 px-3.5 py-2 text-sm">
            <span className="font-semibold">{fmt(t.cart.parcelFrom, { store: parcel.store.name })}</span>
            <span className="font-bold tabular-nums">{money(parcel.cost.totalMinor)}</span>
          </p>
          <ul className="divide-y divide-line">
            {parcel.lines.map((line) => (
              <li key={line.offerId} className="flex items-center gap-3 px-3.5 py-2">
                <span className="size-10 shrink-0 overflow-hidden rounded-lg border border-line">
                  <ProductImage imageUrl={line.product.imageUrl} title={line.product.title} category={line.product.categorySlug as CategorySlug} />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="line-clamp-1 font-medium">{line.product.title}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {line.quantity} × · {money(line.itemsMinor)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(line.offerId)}
                  aria-label={fmt(m.removeItem, { title: line.product.title })}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {priced.view.unavailable.map((line) => (
        <p key={line.offerId} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-2 text-sm text-muted">
          <span className="min-w-0 flex-1 truncate line-through">{line.product.title}</span>
          <span className="shrink-0 text-xs">{line.reason === "outOfStock" ? t.cart.outOfStock : t.cart.gone}</span>
          <button
            type="button"
            onClick={() => onRemove(line.offerId)}
            aria-label={fmt(m.removeItem, { title: line.product.title })}
            className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-surface hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </p>
      ))}
    </div>
  );
}

/** The cart's parcels to tick; "Add" attaches every line of the ticked ones. */
function CartPanel({
  cartItems,
  preselect,
  onAdd,
  onCancel,
}: {
  cartItems: CartItem[];
  preselect: boolean;
  onAdd: (lines: CartItem[]) => void;
  onCancel: () => void;
}) {
  const { t, money } = useI18n();
  const m = t.messages;
  const priced = usePriced(cartItems);
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const parcels = priced?.view.parcels ?? [];
  // Coming from the cart page every parcel starts ticked.
  const selected = ticked ?? new Set(preselect ? parcels.map((parcel) => parcel.store.id) : []);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTicked(next);
  };
  const lines = (parcel: Parcel) => parcel.lines.map((line) => ({ offerId: line.offerId, quantity: line.quantity }));

  return (
    <div className="mb-3 rounded-xl border border-brand/40 bg-brand-soft/40 p-3.5">
      <p className="text-sm font-semibold">{m.cartPanelTitle}</p>
      <p className="text-xs text-muted">{m.cartPanelHint}</p>
      {!priced ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {m.loadingItems}
        </p>
      ) : parcels.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{m.cartPanelEmpty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {parcels.map((parcel) => {
            const on = selected.has(parcel.store.id);
            return (
              <li key={parcel.store.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3 transition-colors",
                    on ? "border-brand" : "border-line hover:border-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(parcel.store.id)}
                    className="mt-0.5 size-4 shrink-0 accent-brand"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="font-semibold">{fmt(t.cart.parcelFrom, { store: parcel.store.name })}</span>
                      <span className="font-bold tabular-nums">{money(parcel.cost.totalMinor)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {fmt(m.parcelItems, { count: parcel.lines.reduce((sum, line) => sum + line.quantity, 0) })}:{" "}
                      {parcel.lines.map((line) => line.product.title).join(", ")}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={selected.size === 0}
          onClick={() => onAdd(parcels.filter((parcel) => selected.has(parcel.store.id)).flatMap(lines))}
        >
          {m.addSelected}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          {m.cancel}
        </Button>
      </div>
    </div>
  );
}
