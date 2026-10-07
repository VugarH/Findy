"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AUDIENCES } from "@/config/audience";
import { CURRENCIES } from "@/config/currencies";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import {
  createProductAction,
  mergeProductAction,
  saveOfferAction,
  saveProductAction,
} from "@/modules/admin/actions/products";
import { minorToInput, type AdminFormState } from "@/modules/admin/forms";
import { useAdminT } from "./admin-i18n";
import { CategoryPicker } from "./category-picker";
import { CheckboxField, FormMessage, HiddenFields, SelectField, SubmitButton, TextField, useAdminForm } from "./fields";
import { NoticeBanner } from "./ui";

/** What the product forms need to know about a product (all optional for a new one). */
export interface ProductFormValues {
  id?: string;
  title?: string;
  brand?: string | null;
  model?: string | null;
  gtin?: string | null;
  imageUrl?: string | null;
  weightKg?: number | null;
  categorySlug?: string;
  subcategorySlug?: string;
  audience?: string | null;
  lockedFields?: string[];
}

export interface StoreChoice {
  id: string;
  name: string;
  currency: string;
}

/** Fields shared by the edit and the new-product forms. */
function ProductFields({ product, state }: { product: ProductFormValues; state: AdminFormState }) {
  const t = useAdminT();
  const { t: site } = useI18n();
  const d = t.products.detail;
  const locked = new Set(product.lockedFields ?? []);
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const error = (name: string) => state.errors?.[name];
  const audienceName = (value: string | null | undefined) =>
    value ? (site.audiences[value as keyof typeof site.audiences] ?? value) : d.audienceNone;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label={d.title}
        name="title"
        defaultValue={v("title", product.title ?? "")}
        error={error("title")}
        required
        maxLength={200}
        className="sm:col-span-2"
      />
      <TextField
        label={d.brand}
        name="brand"
        defaultValue={v("brand", product.brand ?? "")}
        error={error("brand")}
        optional
        maxLength={80}
      />
      <TextField
        label={d.gtin}
        name="gtin"
        defaultValue={v("gtin", product.gtin ?? "")}
        error={error("gtin")}
        optional
        inputMode="numeric"
      />
      <CategoryPicker
        category={v("categorySlug", product.categorySlug ?? "")}
        subcategory={v(
          "subcategory",
          product.id && locked.has("subcategorySlug") ? (product.subcategorySlug ?? "auto") : "auto",
        )}
        automaticNow={product.id && !locked.has("subcategorySlug") ? product.subcategorySlug : undefined}
        errors={{ category: error("categorySlug"), subcategory: error("subcategory") }}
        required
      />
      <SelectField
        label={d.audience}
        name="audience"
        defaultValue={v("audience", product.id && locked.has("audience") ? (product.audience ?? "none") : "auto")}
        error={error("audience")}
        options={[
          {
            value: "auto",
            label:
              product.id && !locked.has("audience")
                ? fmt(t.common.automaticNow, { value: audienceName(product.audience) })
                : t.common.automatic,
          },
          ...AUDIENCES.map((audience) => ({ value: audience, label: site.audiences[audience] })),
          { value: "none", label: d.audienceNone },
        ]}
      />
      <TextField
        label={d.weightKg}
        name="weightKg"
        defaultValue={v("weightKg", product.weightKg ? String(product.weightKg) : "")}
        hint={d.weightHint}
        error={error("weightKg")}
        optional
        inputMode="decimal"
      />
      <TextField
        label={d.imageUrl}
        name="imageUrl"
        type="url"
        defaultValue={v("imageUrl", product.imageUrl ?? "")}
        error={error("imageUrl")}
        optional
        className="sm:col-span-2"
      />
    </div>
  );
}

export function ProductForm({ product }: { product: ProductFormValues }) {
  const t = useAdminT();
  const [state, action, key] = useAdminForm(saveProductAction);
  return (
    <form key={key} action={action} className="space-y-4">
      <HiddenFields values={{ id: product.id }} />
      <ProductFields product={product} state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel={t.common.saving}>{t.common.save}</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export interface OfferFormValues {
  id: string;
  supplierId: string;
  url: string;
  priceMinor: number;
  listPriceMinor: number | null;
  shippingMinor: number | null;
  currency: string;
  inStock: boolean;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
}

/** The fields of a price entered by hand. `prefix` namespaces them inside a bigger form ("offer."). */
function OfferFields({
  stores,
  offer,
  state,
  prefix = "",
}: {
  stores: StoreChoice[];
  offer?: OfferFormValues;
  state: AdminFormState;
  prefix?: string;
}) {
  const t = useAdminT();
  const f = t.products.offerForm;
  const name = (field: string) => `${prefix}${field}`;
  const v = (field: string, fallback: string) => state.values?.[name(field)] ?? fallback;
  const error = (field: string) => state.errors?.[name(field)];
  const [currency, setCurrency] = useState(v("currency", offer?.currency ?? stores[0]?.currency ?? "AZN"));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SelectField
        label={f.store}
        name={name("supplierId")}
        defaultValue={v("supplierId", offer?.supplierId ?? "")}
        error={error("supplierId")}
        onChange={(event) => {
          const store = stores.find((candidate) => candidate.id === event.target.value);
          if (store) setCurrency(store.currency);
        }}
        options={[
          { value: "", label: f.chooseStore },
          ...stores.map((store) => ({ value: store.id, label: store.name })),
        ]}
        className="sm:col-span-2"
      />
      <TextField
        label={f.url}
        name={name("url")}
        type="url"
        defaultValue={v("url", offer?.url ?? "")}
        error={error("url")}
        required
        placeholder="https://"
        className="sm:col-span-2"
      />
      <TextField
        label={f.price}
        name={name("price")}
        defaultValue={v("price", minorToInput(offer?.priceMinor))}
        error={error("price")}
        required
        inputMode="decimal"
      />
      <TextField
        label={f.listPrice}
        name={name("listPrice")}
        defaultValue={v("listPrice", minorToInput(offer?.listPriceMinor))}
        error={error("listPrice")}
        optional
        inputMode="decimal"
      />
      <SelectField
        label={f.currency}
        name={name("currency")}
        value={currency}
        onChange={(event) => setCurrency(event.target.value)}
        error={error("currency")}
        options={Object.keys(CURRENCIES).map((code) => ({ value: code, label: code }))}
      />
      <TextField
        label={f.shipping}
        name={name("shipping")}
        defaultValue={v("shipping", offer?.shippingMinor === 0 ? "0" : minorToInput(offer?.shippingMinor))}
        hint={f.shippingHint}
        error={error("shipping")}
        optional
        inputMode="decimal"
      />
      <TextField
        label={f.deliveryMin}
        name={name("deliveryMin")}
        type="number"
        min={0}
        max={120}
        defaultValue={v("deliveryMin", offer?.deliveryMinDays?.toString() ?? "")}
        error={error("deliveryMin")}
        optional
      />
      <TextField
        label={f.deliveryMax}
        name={name("deliveryMax")}
        type="number"
        min={0}
        max={120}
        defaultValue={v("deliveryMax", offer?.deliveryMaxDays?.toString() ?? "")}
        error={error("deliveryMax")}
        optional
      />
      <CheckboxField
        label={f.inStock}
        name={name("inStock")}
        defaultChecked={state.values ? state.values[name("inStock")] === "on" : (offer?.inStock ?? true)}
        className="self-end pb-2.5 sm:col-span-2"
      />
    </div>
  );
}

/** Adds a price entered by hand to a product, or changes one. */
export function OfferForm({
  productId,
  stores,
  offer,
  onDone,
}: {
  productId: string;
  stores: StoreChoice[];
  offer?: OfferFormValues;
  onDone?: () => void;
}) {
  const t = useAdminT();
  const [state, action, key] = useAdminForm(saveOfferAction, (result) => {
    if (result.notice) onDone?.();
  });
  return (
    <form key={key} action={action} className="space-y-4">
      <HiddenFields values={{ productId, offerId: offer?.id }} />
      <OfferFields stores={stores} offer={offer} state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm" pendingLabel={t.common.saving}>
          {t.products.offerForm.save}
        </SubmitButton>
        {onDone && (
          <button type="button" onClick={onDone} className="h-9 rounded-lg px-3 text-sm text-muted hover:bg-surface-2">
            {t.products.offerForm.cancel}
          </button>
        )}
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/** A button that opens a form in place (add or edit a price). */
export function Reveal({
  label,
  children,
  variant = "secondary",
}: {
  label: string;
  children: (close: () => void) => ReactNode;
  variant?: "secondary" | "link";
}) {
  const [open, setOpen] = useState(false);
  if (open)
    return <div className="rounded-xl border border-line bg-surface-2/40 p-4">{children(() => setOpen(false))}</div>;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={
        variant === "link"
          ? "text-xs font-semibold text-brand-strong hover:underline"
          : "h-9 rounded-lg border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2"
      }
    >
      {label}
    </button>
  );
}

export function MergeForm({ productId }: { productId: string }) {
  const t = useAdminT();
  const { locale } = useI18n();
  const m = t.products.merge;
  const [state, action, key] = useAdminForm(mergeProductAction);
  return (
    <form key={key} action={action} className="space-y-3">
      <HiddenFields values={{ id: productId, locale }} />
      <p className="text-sm text-muted">{m.hint}</p>
      <TextField
        label={m.target}
        name="target"
        defaultValue={state.values?.target ?? ""}
        hint={m.targetHint}
        error={state.errors?.target}
        required
      />
      <SubmitButton variant="secondary" size="sm" confirm={m.confirm} pendingLabel={t.common.saving}>
        {m.button}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function NewProductForm({ stores }: { stores: StoreChoice[] }) {
  const t = useAdminT();
  const { locale, href } = useI18n();
  const n = t.products.new;
  const [state, action, key] = useAdminForm(createProductAction);
  const existing = state.formError === "productExists" ? state.noticeVars : undefined;

  return (
    <form key={key} action={action} className="space-y-6">
      <HiddenFields values={{ locale }} />
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-bold">{n.product}</h2>
        <ProductFields product={{}} state={state} />
        <TextField
          label={t.products.detail.model}
          name="model"
          defaultValue={state.values?.model ?? ""}
          optional
          maxLength={120}
          className="mt-4 sm:max-w-sm"
        />
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-bold">{n.firstOffer}</h2>
        <OfferFields stores={stores} state={state} prefix="offer." />
        <p className="mt-3 text-xs text-muted">{t.products.detail.offerHint}</p>
      </section>
      {existing ? (
        <NoticeBanner tone="bad">
          {fmt(t.errors.productExists, { title: String(existing.title) })}{" "}
          <Link href={href(`/admin/products/${existing.id}`)} className="underline">
            {n.openExisting}
          </Link>
        </NoticeBanner>
      ) : (
        <FormMessage state={state} />
      )}
      <SubmitButton pendingLabel={t.common.saving}>{n.create}</SubmitButton>
    </form>
  );
}
