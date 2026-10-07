"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, PlugZap } from "lucide-react";
import { CATEGORIES } from "@/config/categories";
import { CURRENCIES, isCurrencyCode } from "@/config/currencies";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { storeFormAction } from "@/modules/admin/actions/stores";
import { LIST_PRICE_SOURCES } from "@/modules/suppliers/adapters/structured-data/list-price";
import { CONNECTION_TYPES, type ConnectionType, type CustomStore } from "@/modules/suppliers/custom-config";
import { RELIABILITY_BASES } from "@/modules/suppliers/types";
import { buttonClass } from "@/components/ui/button";
import { useAdminT } from "./admin-i18n";
import { CheckboxField, FormMessage, HiddenFields, SelectField, TextField, useAdminForm } from "./fields";
import { NoticeBanner } from "./ui";

/** The form that adds a store, or changes the settings of one added in the panel. */
export function StoreForm({ store }: { store?: CustomStore }) {
  const t = useAdminT();
  const { t: site, locale, money } = useI18n();
  const [state, action, key] = useAdminForm(storeFormAction);
  const f = t.stores.form;

  const connection = store?.config.connection;
  const initial: Record<string, string> = {
    name: store?.name ?? "",
    websiteUrl: store?.websiteUrl ?? "",
    originCountry: store?.originCountry ?? "TR",
    currency: store?.currency ?? "TRY",
    reliabilityBasis: store?.config.reliability.basis ?? "official-brand-store",
    reliabilityNote: store?.config.reliability.note ?? "",
    shipsToMarket: store?.config.shipsToMarket ? "on" : "",
    mainCategory: store?.config.categories[0] ?? "",
    otherCategories: store?.config.categories.slice(1).join(",") ?? "",
    "connection.type": connection?.type ?? "shopify",
    "connection.brand": connection && "brand" in connection ? (connection.brand ?? "") : "",
    "connection.sitemap": connection?.type === "structured-data" ? connection.sitemap : "",
    "connection.productUrl": connection?.type === "structured-data" ? connection.productUrl : "",
    "connection.productSitemaps": connection?.type === "structured-data" ? (connection.productSitemaps ?? "") : "",
    "connection.focus": connection?.type === "structured-data" ? (connection.focus ?? "") : "",
    "connection.listPrice": connection?.type === "structured-data" ? (connection.listPrice ?? "") : "",
    "connection.brandFromTitle": connection?.type === "structured-data" && connection.brandFromTitle ? "on" : "",
    "connection.productsPerRun": connection?.type === "structured-data" ? String(connection.productsPerRun ?? "") : "",
  };
  // After a submit, show what was typed (the form resets to these defaults).
  const v = (name: string) => state.values?.[name] ?? (state.values ? "" : initial[name]);
  const [type, setType] = useState<ConnectionType>((initial["connection.type"] as ConnectionType) ?? "shopify");
  const others = new Set(v("otherCategories").split(","));
  const error = (name: string) => state.errors?.[name];
  const preview = state.preview;

  return (
    <form key={key} action={action} className="space-y-6">
      <HiddenFields values={{ locale, id: store?.id }} />

      <fieldset className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
        <TextField label={f.name} name="name" defaultValue={v("name")} error={error("name")} required maxLength={80} />
        <TextField
          label={f.websiteUrl}
          name="websiteUrl"
          type="url"
          defaultValue={v("websiteUrl")}
          hint={f.websiteHint}
          error={error("websiteUrl")}
          required
          placeholder="https://"
        />
        <TextField
          label={f.originCountry}
          name="originCountry"
          defaultValue={v("originCountry")}
          hint={f.originCountryHint}
          error={error("originCountry")}
          required
          maxLength={2}
          className="sm:max-w-40"
        />
        <SelectField
          label={f.currency}
          name="currency"
          defaultValue={v("currency")}
          error={error("currency")}
          options={Object.keys(CURRENCIES).map((code) => ({ value: code, label: code }))}
          className="sm:max-w-40"
        />
        <SelectField
          label={f.reliabilityBasis}
          name="reliabilityBasis"
          defaultValue={v("reliabilityBasis")}
          error={error("reliabilityBasis")}
          options={RELIABILITY_BASES.map((basis) => ({ value: basis, label: f.bases[basis] }))}
        />
        <TextField
          label={f.reliabilityNote}
          name="reliabilityNote"
          defaultValue={v("reliabilityNote")}
          hint={f.reliabilityNoteHint}
          optional
          maxLength={500}
        />
        <CheckboxField
          label={f.shipsToMarket}
          name="shipsToMarket"
          defaultChecked={v("shipsToMarket") === "on"}
          className="sm:col-span-2"
        />
      </fieldset>

      <fieldset className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <SelectField
          label={f.mainCategory}
          name="mainCategory"
          defaultValue={v("mainCategory")}
          hint={f.mainCategoryHint}
          error={error("mainCategory")}
          options={[
            { value: "", label: "—" },
            ...CATEGORIES.map((c) => ({ value: c.slug, label: site.categories[c.slug].name })),
          ]}
          className="sm:max-w-sm"
        />
        <div>
          <p className="mb-2 text-sm font-semibold">
            {f.otherCategories} <span className="font-normal text-muted">({t.common.optional})</span>
          </p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <CheckboxField
                key={c.slug}
                label={site.categories[c.slug].name}
                name="otherCategories"
                value={c.slug}
                defaultChecked={others.has(c.slug)}
              />
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <legend className="sr-only">{f.connection}</legend>
        <p className="text-sm font-semibold">{f.connection}</p>
        <div className="grid gap-3 md:grid-cols-3">
          {CONNECTION_TYPES.map((option) => (
            <label
              key={option}
              className={cn(
                "cursor-pointer rounded-xl border p-4 text-sm transition-colors",
                type === option ? "border-brand bg-brand-soft/40" : "border-line hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="connection.type"
                value={option}
                checked={type === option}
                onChange={() => setType(option)}
                className="sr-only"
              />
              <span className="block font-semibold">{f.connectionTypes[option].name}</span>
              <span className="mt-1 block text-xs text-muted">{f.connectionTypes[option].hint}</span>
            </label>
          ))}
        </div>

        {type === "shopify" && (
          <TextField
            label={f.brand}
            name="connection.brand"
            defaultValue={v("connection.brand")}
            hint={f.brandHint}
            optional
            className="sm:max-w-sm"
          />
        )}

        {type === "structured-data" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={f.sitemap}
              name="connection.sitemap"
              type="url"
              defaultValue={v("connection.sitemap")}
              error={error("connection.sitemap")}
              required
              placeholder="https://www.example.com/sitemap.xml"
              className="sm:col-span-2"
            />
            <TextField
              label={f.productUrl}
              name="connection.productUrl"
              defaultValue={v("connection.productUrl")}
              hint={f.productUrlHint}
              error={error("connection.productUrl")}
              required
              className="font-mono"
            />
            <TextField
              label={f.productSitemaps}
              name="connection.productSitemaps"
              defaultValue={v("connection.productSitemaps")}
              hint={f.productSitemapsHint}
              error={error("connection.productSitemaps")}
              optional
            />
            <TextField
              label={f.focus}
              name="connection.focus"
              defaultValue={v("connection.focus")}
              hint={f.focusHint}
              error={error("connection.focus")}
              optional
            />
            <SelectField
              label={f.listPrice}
              name="connection.listPrice"
              defaultValue={v("connection.listPrice")}
              options={[
                { value: "", label: f.listPriceNone },
                ...LIST_PRICE_SOURCES.map((source) => ({ value: source, label: f.listPrices[source] })),
              ]}
            />
            <TextField
              label={f.brand}
              name="connection.brand"
              defaultValue={v("connection.brand")}
              hint={f.brandHint}
              optional
            />
            <TextField
              label={f.productsPerRun}
              name="connection.productsPerRun"
              type="number"
              min={10}
              max={1000}
              defaultValue={v("connection.productsPerRun")}
              hint={f.productsPerRunHint}
              error={error("connection.productsPerRun")}
              optional
            />
            <CheckboxField
              label={f.brandFromTitle}
              name="connection.brandFromTitle"
              defaultChecked={v("connection.brandFromTitle") === "on"}
              className="sm:col-span-2"
            />
            <p className="text-xs text-muted sm:col-span-2">{f.probeHint}</p>
          </div>
        )}
      </fieldset>

      <FormMessage state={state} />
      {preview && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-bold">{f.previewTitle}</h2>
          {preview.error ? (
            <div className="mt-3">
              <NoticeBanner tone="bad">{fmt(f.previewFailed, { error: preview.error })}</NoticeBanner>
            </div>
          ) : preview.total === 0 && type === "manual" ? (
            <p className="mt-2 text-sm text-muted">{f.previewManual}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">{fmt(f.previewCount, { count: preview.total })}</p>
              <ul className="mt-3 divide-y divide-line text-sm">
                {preview.sample.map((offer) => (
                  <li
                    key={offer.externalId}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
                  >
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      {offer.title}
                    </a>
                    <span className="text-xs text-muted">
                      {offer.brand ?? "—"} · {site.categories[offer.categorySlug].name}
                    </span>
                    <span className="tabular-nums">
                      {isCurrencyCode(offer.currency) ? money(offer.priceMinor, offer.currency) : offer.priceMinor}
                      {offer.listPriceMinor && isCurrencyCode(offer.currency) && (
                        <s className="ml-1.5 text-xs text-muted">{money(offer.listPriceMinor, offer.currency)}</s>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <IntentButton intent="test" variant="secondary" label={f.test} pendingLabel={f.testing} icon />
        <IntentButton
          intent="save"
          variant="primary"
          label={store ? f.save : f.create}
          pendingLabel={t.common.saving}
        />
      </div>
    </form>
  );
}

/** One of the form's two submit buttons; only the one pressed shows the spinner. */
function IntentButton({
  intent,
  variant,
  label,
  pendingLabel,
  icon,
}: {
  intent: string;
  variant: "primary" | "secondary";
  label: string;
  pendingLabel: string;
  icon?: boolean;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("intent") === intent;
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      className={buttonClass({ variant }, "rounded-lg")}
    >
      {mine ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        icon && <PlugZap className="size-4" aria-hidden />
      )}
      {mine ? pendingLabel : label}
    </button>
  );
}
