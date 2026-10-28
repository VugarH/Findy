"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { CategorySlug } from "@/config/categories";
import type { ProductCardData } from "@/modules/catalog/card";
import { hasInterests } from "@/modules/recommendations/profile";
import { ProductGrid } from "@/components/deals/product-grid";
import { forgetInterests, readInterests } from "./interest-store";

const RECOMMEND_URL = "/api/recommendations";
/** Fewer matches than this are not worth a row. */
const MIN_CARDS = 4;

interface Props {
  /** Only within this category (a category page). */
  category?: CategorySlug;
  limit?: number;
  density?: "comfortable" | "compact";
  className?: string;
}

/**
 * "Recommended for you": asked for after the page is shown, from the
 * interests in this browser, so it never delays the page. Shows nothing for a
 * new visitor, when too few deals fit, or when the request fails.
 */
export function RecommendedRow({ category, limit = 8, density = "comfortable", className }: Props) {
  const { t, money, href } = useI18n();
  const [cards, setCards] = useState<ProductCardData[]>([]);

  useEffect(() => {
    const profile = readInterests();
    if (!hasInterests(profile)) return;
    const controller = new AbortController();
    fetch(RECOMMEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, category, limit }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { cards: [] }))
      .then((body: { cards: ProductCardData[] }) => setCards(body.cards ?? []))
      .catch(() => {
        // A convenience: a failure just shows no row.
      });
    return () => controller.abort();
  }, [category, limit]);

  if (cards.length < MIN_CARDS) return null;
  return (
    <section className={className} aria-labelledby="recommended-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="recommended-title" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Sparkles className="size-5 text-brand" aria-hidden />
            {t.recommendations.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{t.recommendations.hint}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            forgetInterests();
            setCards([]);
          }}
          className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {t.recommendations.clear}
        </button>
      </div>
      <ProductGrid cards={cards} density={density} t={t} money={money} href={href} />
    </section>
  );
}
