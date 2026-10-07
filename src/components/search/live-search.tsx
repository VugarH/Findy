"use client";

import { Check, LoaderCircle, Radar, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import { cn } from "@/lib/cn";
import type { ProductCardData } from "@/modules/catalog/card";
import type { LiveSearchEvent } from "@/modules/search/live-search";
import { ProductGrid } from "@/components/deals/product-grid";
import { Button } from "@/components/ui/button";
import { ScopeTag } from "@/components/ui/scope-tag";

type StoreStatus = "waiting" | "found" | "none" | "failed";

interface StoreState {
  id: string;
  name: string;
  scope: "local" | "global";
  status: StoreStatus;
  found: number;
}

type Phase = "idle" | "running" | "done" | "error";

/**
 * Step two of a search: ask every store right now and show answers as they
 * arrive. Starts on its own when the catalog had nothing.
 */
export function LiveSearch({ query, autoStart }: { query: string; autoStart: boolean }) {
  const { t, money, href } = useI18n();
  // `run` counts attempts; 0 means the live search has not been started.
  const [run, setRun] = useState(autoStart ? 1 : 0);
  const [phase, setPhase] = useState<Phase>(autoStart ? "running" : "idle");
  const [stores, setStores] = useState<StoreState[]>([]);
  const [products, setProducts] = useState<ProductCardData[]>([]);

  function start() {
    setStores([]);
    setProducts([]);
    setPhase("running");
    setRun((current) => current + 1);
  }

  useEffect(() => {
    if (run === 0) return;
    const source = new EventSource(`/api/search/live?q=${encodeURIComponent(query)}`);

    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as LiveSearchEvent;
      if (event.type === "start") {
        setStores(event.suppliers.map((s) => ({ ...s, status: "waiting", found: 0 })));
      } else if (event.type === "supplier") {
        setStores((current) =>
          current.map((store) =>
            store.id === event.supplierId
              ? { ...store, found: event.found, status: !event.ok ? "failed" : event.found > 0 ? "found" : "none" }
              : store,
          ),
        );
        setProducts(event.products);
      } else {
        setProducts(event.products);
        setPhase("done");
        source.close();
      }
    };
    source.onerror = () => {
      source.close();
      setPhase((current) => (current === "done" ? current : "error"));
    };

    return () => source.close();
  }, [run, query]);

  if (phase === "idle") {
    return (
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
        <Radar className="size-7 text-brand" aria-hidden />
        <p className="max-w-md text-sm text-muted">{t.search.liveCtaHint}</p>
        <Button onClick={start}>{t.search.liveCta}</Button>
      </section>
    );
  }

  const answered = stores.filter((store) => store.status !== "waiting").length;
  const total = stores.length;

  return (
    <section>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Radar className="size-5 text-brand" aria-hidden />
            {t.search.liveTitle}
          </h2>
          <p className="text-sm text-muted" aria-live="polite">
            {phase === "running" && fmt(t.search.liveSearching, { done: answered, total })}
            {phase === "done" && fmt(t.search.liveDone, { total, count: products.length })}
            {phase === "error" && t.search.liveError}
          </p>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500"
            style={{ width: `${total ? (answered / total) * 100 : 4}%` }}
          />
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stores.map((store) => (
            <li key={store.id} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <StatusIcon status={store.status} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{store.name}</span>
                <span className="block text-xs text-muted">
                  {store.status === "waiting" && t.search.storeWaiting}
                  {store.status === "found" && fmt(t.search.storeFound, { count: store.found })}
                  {store.status === "none" && t.search.storeNone}
                  {store.status === "failed" && t.search.storeFailed}
                </span>
              </span>
              <ScopeTag scope={store.scope} label={store.scope === "local" ? t.deal.local : t.deal.global} />
            </li>
          ))}
        </ul>

        {phase === "error" && (
          <Button variant="secondary" size="sm" onClick={start} className="mt-4">
            {t.search.retry}
          </Button>
        )}
      </div>

      {products.length > 0 && (
        <div className="mt-5">
          <ProductGrid cards={products} t={t} money={money} href={href} />
        </div>
      )}
      {phase === "done" && products.length === 0 && (
        <p className="mt-5 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">
          {t.search.liveNone}
        </p>
      )}
    </section>
  );
}

function StatusIcon({ status }: { status: StoreStatus }) {
  const base = "grid size-6 shrink-0 place-items-center rounded-full";
  if (status === "waiting") {
    return (
      <span className={cn(base, "text-muted")}>
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      </span>
    );
  }
  if (status === "found") {
    return (
      <span className={cn(base, "bg-brand text-on-brand")}>
        <Check className="size-3.5" aria-hidden strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-line text-muted")}>
      <X className="size-3.5" aria-hidden strokeWidth={3} />
    </span>
  );
}
