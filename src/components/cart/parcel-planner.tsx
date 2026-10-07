"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Loader2, Minus, PackageCheck, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import type { CategorySlug } from "@/config/categories";
import { LOCALE_TAGS } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { flag } from "@/lib/flag";
import { priceCartAction } from "@/modules/cart/actions";
import { CART_LIMITS } from "@/modules/cart/items";
import type { CartView, Parcel, PlannedLine, UnavailableLine } from "@/modules/cart/plan";
import { ProductImage } from "@/components/product/product-image";
import { ButtonLink } from "@/components/ui/button";
import { ScopeTag } from "@/components/ui/scope-tag";
import { cart, useCartItems, useHydrated } from "./cart-store";

/** Waits this long after the last change before re-pricing, so quick +/+/+ clicks make one request. */
const REPRICE_DELAY_MS = 250;

/**
 * The cart page: the cart from this browser, priced on the server with today's
 * offers and split into parcels — one per store — each with its delivery,
 * customs and a link to the store.
 */
export function ParcelPlanner() {
  const { t, href } = useI18n();
  const c = t.cart;
  const hydrated = useHydrated();
  const items = useCartItems();
  const key = JSON.stringify(items);
  const [result, setResult] = useState<{ key: string; view: CartView } | { key: string; failed: true } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      priceCartAction(items)
        .then((view) => {
          if (cancelled) return;
          setResult({ key, view });
          // Listings deleted from the catalogue cannot come back: drop them quietly.
          if (view.unknown.length) cart.remove(...view.unknown);
        })
        .catch(() => !cancelled && setResult({ key, failed: true }));
    }, REPRICE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `key` stands for `items`: re-price only when the cart's content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated, attempt]);

  if (!hydrated || (items.length > 0 && !result)) {
    return (
      <p className="flex items-center gap-2 py-16 text-sm text-muted">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {c.loading}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <ShoppingBag className="mx-auto size-8 text-muted" aria-hidden />
        <p className="mt-3 font-semibold">{c.empty}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{c.emptyText}</p>
        <ButtonLink href={href("/deals")} variant="secondary" size="sm" className="mt-5">
          {c.browse}
        </ButtonLink>
      </section>
    );
  }

  if (result && "failed" in result) {
    return (
      <p className="py-16 text-sm text-muted">
        {c.failed}{" "}
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-semibold text-brand-strong hover:underline">
          {c.retry}
        </button>
      </p>
    );
  }

  const view = result!.view;
  const stale = result!.key !== key;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className={cn("min-w-0 space-y-6 transition-opacity", stale && "opacity-60")} aria-busy={stale}>
        {view.parcels.map((parcel) => (
          <ParcelCard key={parcel.store.id} parcel={parcel} />
        ))}
        {view.unavailable.length > 0 && <UnavailableList lines={view.unavailable} />}
      </div>
      <Summary view={view} />
    </div>
  );
}

function ParcelCard({ parcel }: { parcel: Parcel }) {
  const { t, money, locale } = useI18n();
  const c = t.cart;
  const { store, cost, customs } = parcel;
  const kg = new Intl.NumberFormat(LOCALE_TAGS[locale], { maximumFractionDigits: 1 }).format(parcel.weightKg);
  const rows = [
    { label: c.items, value: cost.itemMinor },
    { label: cost.shippingEstimated ? c.shippingEstimated : c.shipping, value: cost.shippingMinor },
    { label: c.duty, value: cost.dutyMinor, optional: true },
    { label: c.vat, value: cost.vatMinor, optional: true },
    { label: c.fee, value: cost.feeMinor, optional: true },
  ].filter((row) => !row.optional || row.value > 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-bold">
            <span aria-hidden>{flag(store.originCountry)}</span>
            {fmt(c.parcelFrom, { store: store.name })}
            <ScopeTag scope={store.scope} label={store.scope === "local" ? t.deal.local : t.deal.global} />
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Truck className="size-3.5" aria-hidden />
              {fmt(t.product.deliveryRange, parcel.delivery)}
            </span>
            {store.scope !== "local" && <span>{fmt(c.weight, { kg })}</span>}
          </p>
        </div>
        <a
          href={store.websiteUrl}
          target="_blank"
          rel="nofollow noopener"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
        >
          {c.storeSite}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      </header>

      {customs && <CustomsMeter customs={customs} />}

      <ul className="divide-y divide-line">
        {parcel.lines.map((line) => (
          <LineRow key={line.offerId} line={line} />
        ))}
      </ul>

      <dl className="space-y-1.5 border-t border-line bg-surface-2/40 px-4 py-4 text-sm sm:px-5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted">{row.label}</dt>
            <dd className="tabular-nums">{money(row.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-line pt-2 font-bold">
          <dt>{c.parcelTotal}</dt>
          <dd className="tabular-nums">{money(cost.totalMinor)}</dd>
        </div>
        {parcel.savingsMinor > 0 && (
          <p className="flex items-start gap-1.5 pt-1 text-xs font-semibold text-brand-strong">
            <PackageCheck className="mt-px size-3.5 shrink-0" aria-hidden />
            {fmt(c.together, { amount: money(parcel.savingsMinor), count: parcel.lines.length })}
          </p>
        )}
      </dl>
    </section>
  );
}

/** How full the parcel is against the duty-free limit. */
function CustomsMeter({ customs }: { customs: NonNullable<Parcel["customs"]> }) {
  const { t, money } = useI18n();
  const c = t.cart;
  const over = customs.overMinor > 0;
  const filled = Math.min(100, Math.round((customs.valueMinor / customs.limitMinor) * 100));
  return (
    <div className={cn("border-b border-line px-4 py-3 sm:px-5", over && "bg-deal-soft/50")}>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={filled}
        aria-label={c.dutyFreeMeter}
      >
        <div className={cn("h-full rounded-full", over ? "bg-deal" : "bg-brand")} style={{ width: `${filled}%` }} />
      </div>
      <p className={cn("mt-2 flex items-start gap-1.5 text-xs", over ? "font-semibold text-deal" : "text-muted")}>
        {over && <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />}
        {over
          ? fmt(c.dutyFreeOver, { over: money(customs.overMinor), charged: money(customs.chargedMinor), limit: money(customs.limitMinor) })
          : fmt(c.dutyFreeRoom, { value: money(customs.valueMinor), limit: money(customs.limitMinor), room: money(customs.roomMinor) })}
      </p>
    </div>
  );
}

function LineRow({ line }: { line: PlannedLine }) {
  const { t, href, money } = useI18n();
  const c = t.cart;
  const { product } = line;
  return (
    <li className="flex gap-3 px-4 py-4 sm:px-5">
      <Link
        href={href(`/product/${product.slug}`)}
        className="size-16 shrink-0 overflow-hidden rounded-xl border border-line bg-surface sm:size-20"
      >
        <ProductImage imageUrl={product.imageUrl} title={product.title} category={product.categorySlug as CategorySlug} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {product.brand && <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">{product.brand}</p>}
            <Link href={href(`/product/${product.slug}`)} className="line-clamp-2 text-sm font-semibold hover:underline">
              {product.title}
            </Link>
          </div>
          <p className="shrink-0 text-right text-sm font-bold tabular-nums">{money(line.itemsMinor)}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {fmt(c.each, { price: money(line.storePriceMinor, line.currency) })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Stepper offerId={line.offerId} quantity={line.quantity} />
          <a
            href={`/go/${line.offerId}`}
            target="_blank"
            rel="nofollow sponsored noopener"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-xs font-semibold hover:bg-surface-2"
          >
            {c.openInStore}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
          <button
            type="button"
            onClick={() => cart.remove(line.offerId)}
            aria-label={fmt(c.removeItem, { title: product.title })}
            title={c.remove}
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-deal"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

function Stepper({ offerId, quantity }: { offerId: string; quantity: number }) {
  const { t } = useI18n();
  const c = t.cart;
  const button = "grid size-8 place-items-center rounded-full text-ink hover:bg-surface-2 disabled:opacity-40";
  return (
    <div className="inline-flex h-8 items-center rounded-full border border-line" role="group" aria-label={c.quantity}>
      <button
        type="button"
        className={button}
        aria-label={c.decrease}
        disabled={quantity <= 1}
        onClick={() => cart.setQuantity(offerId, quantity - 1)}
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className={button}
        aria-label={c.increase}
        disabled={quantity >= CART_LIMITS.quantity}
        onClick={() => cart.setQuantity(offerId, quantity + 1)}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function UnavailableList({ lines }: { lines: UnavailableLine[] }) {
  const { t, href, money } = useI18n();
  const c = t.cart;
  return (
    <section className="rounded-2xl border border-dashed border-line">
      <h2 className="border-b border-line px-4 py-3 text-sm font-bold sm:px-5">{c.unavailableTitle}</h2>
      <ul className="divide-y divide-line">
        {lines.map((line) => (
          <li key={line.offerId} className="flex gap-3 px-4 py-4 sm:px-5">
            <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-line opacity-60">
              <ProductImage
                imageUrl={line.product.imageUrl}
                title={line.product.title}
                category={line.product.categorySlug as CategorySlug}
              />
            </div>
            <div className="min-w-0 flex-1">
              <Link href={href(`/product/${line.product.slug}`)} className="line-clamp-2 text-sm font-semibold hover:underline">
                {line.product.title}
              </Link>
              <p className="text-xs text-muted">
                {line.storeName}: {line.reason === "outOfStock" ? c.outOfStock : c.gone}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {line.alternative && (
                  <button
                    type="button"
                    onClick={() => cart.replace(line.offerId, line.alternative!.offerId)}
                    className="inline-flex h-8 items-center rounded-full bg-brand px-3 text-xs font-semibold text-on-brand hover:bg-brand-strong"
                  >
                    {fmt(c.alternative, { store: line.alternative.storeName, price: money(line.alternative.landedMinor) })}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => cart.remove(line.offerId)}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {c.remove}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Summary({ view }: { view: CartView }) {
  const { t, href, money } = useI18n();
  const c = t.cart;
  const [confirming, setConfirming] = useState(false);
  return (
    <aside className="space-y-4 rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-36">
      <h2 className="text-sm font-bold">{c.summary}</h2>
      <div>
        <p className="text-xs text-muted">{c.total}</p>
        <p className="text-3xl font-extrabold tracking-tight tabular-nums">{money(view.totalMinor)}</p>
        <p className="mt-0.5 text-xs text-muted">{c.totalHint}</p>
      </div>
      <dl className="space-y-1.5 border-t border-line pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{c.products}</dt>
          <dd className="tabular-nums">{view.itemCount}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{c.parcels}</dt>
          <dd className="tabular-nums">{view.parcels.length}</dd>
        </div>
        {view.delivery && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{c.arrival}</dt>
            <dd className="tabular-nums">{fmt(t.product.deliveryRange, view.delivery)}</dd>
          </div>
        )}
        {view.customsMinor > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{c.customsTotal}</dt>
            <dd className="tabular-nums text-deal">{money(view.customsMinor)}</dd>
          </div>
        )}
        {view.savingsMinor > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{c.savingsTotal}</dt>
            <dd className="font-semibold tabular-nums text-brand-strong">{money(view.savingsMinor)}</dd>
          </div>
        )}
      </dl>
      <p className="text-xs text-muted">{c.disclaimer}</p>
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <ButtonLink href={href("/deals")} variant="secondary" size="sm">
          {c.continue}
        </ButtonLink>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{c.clearConfirm}</span>
            <button
              type="button"
              onClick={() => cart.clear()}
              className="font-semibold text-deal hover:underline"
            >
              {c.clearYes}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="font-semibold hover:underline">
              {c.clearNo}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm font-semibold text-muted hover:text-deal"
          >
            {c.clear}
          </button>
        )}
      </div>
    </aside>
  );
}
