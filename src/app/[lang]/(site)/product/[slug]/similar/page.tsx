import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getProductDetail } from "@/modules/catalog/queries";
import { findSimilarProducts, type SimilarProduct } from "@/modules/catalog/similar";
import { getLiveSearchAdapters } from "@/modules/suppliers/registry";
import { ProductGrid } from "@/components/deals/product-grid";
import { LiveSearch } from "@/components/search/live-search";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { robots: { index: false } };

export default async function SimilarPage({ params }: PageProps<"/[lang]/product/[slug]/similar">) {
  const { slug } = await params;
  const { t, money, href, market } = await getI18n();

  const detail = await getProductDetail(slug, market);
  if (!detail) notFound();
  const { product, summary } = detail;
  const best = summary?.best ?? null;

  const similar = await findSimilarProducts(product, market, best?.supplier.id);
  const groups = [
    { title: t.similar.sameTitle, items: similar.filter((item) => item.likelySame) },
    { title: t.similar.similarTitle, items: similar.filter((item) => !item.likelySame) },
  ].filter((group) => group.items.length > 0);

  /** "12 ₼ cheaper" / "30 ₼ more", relative to the product the user came from. */
  const priceNotes = (items: SimilarProduct[]) =>
    Object.fromEntries(
      items.map(({ card }) => {
        if (!best) return [card.slug, null];
        const diff = card.landedMinor - best.landed.totalMinor;
        if (diff === 0) return [card.slug, { text: t.similar.samePrice, tone: "neutral" as const }];
        return [
          card.slug,
          diff < 0
            ? { text: fmt(t.similar.cheaper, { amount: money(-diff) }), tone: "good" as const }
            : { text: fmt(t.similar.dearer, { amount: money(diff) }), tone: "neutral" as const },
        ];
      }),
    );

  return (
    <Container className="space-y-8 py-8">
      <header>
        <Link href={href(`/product/${product.slug}`)} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          {t.similar.back}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{fmt(t.similar.title, { title: product.title })}</h1>
        {best && (
          <p className="mt-1 text-muted">
            {fmt(t.similar.reference, { price: money(best.landed.totalMinor), store: best.supplier.name })}
          </p>
        )}
      </header>

      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="mb-4 text-xl font-bold">{group.title}</h2>
          <ProductGrid
            cards={group.items.map((item) => item.card)}
            notes={priceNotes(group.items)}
            t={t}
            money={money}
            href={href}
          />
        </section>
      ))}

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-muted">{t.similar.none}</p>
      ) : (
        <p className="flex items-start gap-2 text-xs leading-5 text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t.similar.note}
        </p>
      )}

      {/* Stores with an official search API are also asked on the spot. */}
      {getLiveSearchAdapters().length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">{t.similar.liveTitle}</h2>
          <LiveSearch query={[product.brand, product.model].filter(Boolean).join(" ") || product.title} autoStart={false} />
        </section>
      )}
    </Container>
  );
}
