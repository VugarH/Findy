"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";
import type { ProductCardData } from "@/modules/catalog/card";
import { ProductGrid } from "@/components/deals/product-grid";
import { favorites, useFavorites } from "./favorite-store";
import { useHydrated } from "@/components/cart/cart-store";

const FAVORITES_URL = "/api/favorites";

/** The saved products, read from this browser and priced with today's deals. */
export function FavoritesList() {
  const { t, money, href } = useI18n();
  const f = t.favorites;
  const hydrated = useHydrated();
  const ids = useFavorites();
  const key = ids.join(",");
  const [result, setResult] = useState<{ key: string; cards: ProductCardData[] | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch(FAVORITES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: key.split(",") }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body: { cards: ProductCardData[] }) => setResult({ key, cards: body.cards ?? [] }))
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setResult({ key, cards: null });
      });
    return () => controller.abort();
  }, [key]);

  // While a removal refetches, the previous cards stay (minus the removed one).
  if (!hydrated || (key && !result)) return <p className="text-muted">{f.loading}</p>;
  if (ids.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
        <Heart className="mx-auto size-8 text-muted" aria-hidden />
        <h2 className="mt-3 text-lg font-bold">{f.empty}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{f.emptyText}</p>
        <Link href={href("/deals")} className="mt-4 inline-block font-semibold text-brand-strong hover:underline">
          {t.cart.browse}
        </Link>
      </div>
    );
  }
  if (result?.cards === null) return <p className="text-muted">{f.failed}</p>;

  const cards = (result?.cards ?? []).filter((card) => ids.includes(card.productId));
  const shown = new Set(cards.map((card) => card.productId));
  const gone = ids.filter((id) => !shown.has(id));
  return (
    <div className="space-y-5">
      {cards.length > 0 && <ProductGrid cards={cards} t={t} money={money} href={href} />}
      {result?.key === key && gone.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {fmt(f.gone, { count: gone.length })}
          <button type="button" onClick={() => favorites.remove(...gone)} className="font-semibold text-ink underline-offset-2 hover:underline">
            {f.removeGone}
          </button>
        </p>
      )}
    </div>
  );
}
