import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { CategorySlug } from "@/config/categories";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/modules/auth/session";
import { getProductDetail } from "@/modules/catalog/queries";
import { OrderRequestForm } from "@/components/orders/order-request-form";
import { OrderSteps } from "@/components/orders/steps";
import { ProductImage } from "@/components/product/product-image";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { robots: { index: false } };

export default async function OrderPage({ params, searchParams }: PageProps<"/[lang]/product/[slug]/order">) {
  const { slug } = await params;
  const { offer: offerParam } = await searchParams;
  const { t, href, market } = await getI18n();

  const detail = await getProductDetail(slug, market);
  const offerId = typeof offerParam === "string" ? offerParam : undefined;
  // Without an explicit offer, fall back to the best one from abroad.
  const offer =
    detail?.offers.find((candidate) => candidate.offerId === offerId) ?? detail?.summary?.bestGlobal ?? null;
  const orderable =
    detail && offer && market.assistedOrder.enabled && offer.supplier.scope === "global" && offer.inStock;

  if (!orderable) {
    return (
      <Container className="grid place-items-center py-24 text-center">
        <h1 className="text-2xl font-bold">{t.order.unavailableTitle}</h1>
        <p className="mt-2 max-w-md text-muted">{t.order.unavailableText}</p>
        <ButtonLink href={detail ? href(`/product/${slug}`) : href("/deals")} variant="secondary" className="mt-6">
          {detail ? t.order.backToProduct : t.notFound.back}
        </ButtonLink>
      </Container>
    );
  }

  const { product } = detail;
  const user = await getCurrentUser();
  const productHref = href(`/product/${product.slug}`);

  return (
    <Container className="space-y-6 py-8">
      <header>
        <Link href={productHref} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          {t.order.backToProduct}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{t.order.pageTitle}</h1>
        <p className="mt-1 max-w-2xl text-muted">{t.order.pageIntro}</p>
      </header>

      <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-line">
          <ProductImage imageUrl={product.imageUrl} title={product.title} category={product.categorySlug as CategorySlug} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.order.item}</p>
          <p className="truncate font-bold">{product.title}</p>
          <p className="text-sm text-muted">{fmt(t.order.from, { store: offer.supplier.name })}</p>
        </div>
      </div>

      <OrderRequestForm
        offerId={offer.offerId}
        productHref={productHref}
        unitCost={offer.costInput}
        market={market}
        defaults={{ name: user?.fullName ?? "", phone: user?.phone ?? "", email: user?.email ?? "" }}
      />

      <section>
        <h2 className="mb-3 text-lg font-bold">{t.order.stepsTitle}</h2>
        <OrderSteps t={t} compact />
      </section>
    </Container>
  );
}
