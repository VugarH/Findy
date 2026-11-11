"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { ProductCardData } from "@/modules/catalog/card";
import { hasInterests } from "@/modules/recommendations/profile";
import { HeroDealCard } from "@/components/deals/hero-deal-card";
import { readInterests } from "./interest-store";

const RECOMMEND_URL = "/api/recommendations";

const pickOne = <T,>(items: T[]): T | undefined => items[Math.floor(Math.random() * items.length)];

/**
 * The hero's left card, "For you": a random one of this browser's
 * recommendations, else (switched off, a new visitor, nothing fits) a random
 * one of today's deals. Chosen after the page is shown, so server and browser
 * agree on the first render.
 */
export function HeroPick({ fallback, recommendations, excludeId }: { fallback: ProductCardData[]; recommendations: boolean; excludeId?: string }) {
  const { t, money, href } = useI18n();
  const [card, setCard] = useState<ProductCardData | null>(null);

  useEffect(() => {
    const usable = (cards: ProductCardData[]) => cards.filter((c) => c.productId !== excludeId);
    const fromToday = () => setCard(pickOne(usable(fallback)) ?? null);

    const profile = readInterests();
    if (!recommendations || !hasInterests(profile)) {
      fromToday();
      return;
    }
    const controller = new AbortController();
    fetch(RECOMMEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, limit: 8 }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { cards: [] }))
      .then((body: { cards?: ProductCardData[] }) => {
        const chosen = pickOne(usable(body.cards ?? []));
        if (chosen) setCard(chosen);
        else fromToday();
      })
      .catch(() => {
        if (!controller.signal.aborted) fromToday();
      });
    return () => controller.abort();
  }, [fallback, recommendations, excludeId]);

  if (!card) return null;
  return <HeroDealCard card={card} label={t.recommendations.short} money={money} href={href} side="left" />;
}
