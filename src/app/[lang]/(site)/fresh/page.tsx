import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarCheck, ShieldCheck, TrendingDown } from "lucide-react";
import { isCategorySlug } from "@/config/categories";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { countFreshDeals, listFreshDeals } from "@/modules/deals/fresh";
import { orderedCategories } from "@/modules/settings/display-order";
import { getDisplayOrder } from "@/modules/settings/service";
import { ProductGrid } from "@/components/deals/product-grid";
import { ButtonLink } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-icon";
import { Container } from "@/components/ui/container";

type Props = PageProps<"/[lang]/fresh">;

export async function generateMetadata(): Promise<Metadata> {
  const { t, market } = await getI18n();
  return { title: t.fresh.title, description: fmt(t.fresh.intro, { days: market.deals.freshDrop.windowDays }) };
}

/** Fresh real deals (modules/deals/fresh.ts): prices our own checks saw fall in the last few days. */
export default async function FreshDealsPage({ searchParams }: Props) {
  const { t, href, money, market } = await getI18n();
  const { category: param } = await searchParams;
  const category = typeof param === "string" && isCategorySlug(param) ? param : undefined;
  const [cards, counts, order] = await Promise.all([
    listFreshDeals(market, { category }),
    countFreshDeals(market),
    getDisplayOrder(),
  ]);
  const { windowDays, minDropPct } = market.deals.freshDrop;
  const chips = orderedCategories(order).filter((c) => (counts.byCategory[c.slug] ?? 0) > 0);
  const trust = [
    { icon: ShieldCheck, title: t.fresh.trust1Title, text: fmt(t.fresh.trust1Text, { pct: minDropPct, days: windowDays }) },
    { icon: TrendingDown, title: t.fresh.trust2Title, text: t.fresh.trust2Text },
    { icon: CalendarCheck, title: t.fresh.trust3Title, text: fmt(t.fresh.trust3Text, { days: windowDays }) },
  ];

  return (
    <>
      <section className="hero-glow border-b border-line">
        <Container className="py-10">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
            <BadgeCheck className="size-3.5" aria-hidden />
            {t.fresh.badge}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            {counts.total > 0 ? fmt(t.fresh.countTitle, { count: counts.total }) : t.fresh.title}
          </h1>
          <p className="mt-2 max-w-3xl text-pretty text-muted">{fmt(t.fresh.intro, { days: windowDays })}</p>
          <ul className="mt-6 grid gap-3 md:grid-cols-3">
            {trust.map((item) => (
              <li key={item.title} className="flex gap-3 rounded-2xl border border-line bg-surface/70 p-4 backdrop-blur-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
                  <item.icon className="size-[18px]" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="space-y-6 py-8">
        {chips.length > 1 && (
          <nav aria-label={t.fresh.title} className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
            <Chip href={href("/fresh")} active={!category}>
              {t.fresh.all}
              <Count value={counts.total} />
            </Chip>
            {chips.map((c) => (
              <Chip key={c.slug} href={`${href("/fresh")}?category=${c.slug}`} active={category === c.slug}>
                <CategoryIcon category={c.slug} className="size-4" />
                {t.categories[c.slug].short}
                <Count value={counts.byCategory[c.slug]} />
              </Chip>
            ))}
          </nav>
        )}

        {cards.length > 0 ? (
          <ProductGrid cards={cards} t={t} money={money} href={href} freshFocus />
        ) : (
          <section className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p className="text-sm text-muted">{t.fresh.none}</p>
            <ButtonLink href={href("/deals")} variant="secondary" size="sm" className="mt-4">
              {t.top.seeAll}
            </ButtonLink>
          </section>
        )}
      </Container>
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-brand bg-brand-soft font-semibold text-brand-strong" : "border-line bg-surface text-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

function Count({ value }: { value: number | undefined }) {
  return <span className="text-xs tabular-nums opacity-70">{value ?? 0}</span>;
}
