import { ChevronDown } from "lucide-react";
import type { MarketConfig } from "@/config/markets";
import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/i18n/format";

/**
 * The questions people ask before ordering from abroad, answered with the
 * market's own numbers (customs limit, delivery times), so they stay true
 * when the settings change. Native <details>: works without JavaScript.
 */
export function OrderFaq({ t, market, money }: { t: Dictionary; market: MarketConfig; money: (minor: number, currency?: MarketConfig["currency"]) => string }) {
  const days = (country: string) => {
    const range = market.forwarding.deliveryDaysByOrigin[country] ?? market.forwarding.defaultDeliveryDays;
    return `${range.min}–${range.max}`;
  };
  const { amount, currency } = market.customs.dutyFreeThreshold;
  const vars = { threshold: money(amount * 100, currency), tr: days("TR"), eu: days("DE"), us: days("US"), cn: days("CN") };

  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold tracking-tight">{t.order.faqTitle}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {t.order.faq.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="px-5 pb-4 leading-7 text-muted">{fmt(item.a, vars)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
