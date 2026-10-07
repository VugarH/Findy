import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { isCategorySlug } from "@/config/categories";
import { fmt } from "@/i18n/format";
import { setProductActiveAction } from "@/modules/admin/actions/products";
import { listAdminEvents } from "@/modules/admin/audit";
import { param } from "@/modules/admin/forms";
import { getAdminI18n } from "@/modules/admin/i18n";
import { getAdminProduct } from "@/modules/admin/products";
import { listStoreChoices } from "@/modules/admin/stores";
import { lastPublishedAt } from "@/modules/deals/publish";
import { ActionButton } from "@/components/admin/action-button";
import { ActivityList } from "@/components/admin/activity-list";
import { OfferList } from "@/components/admin/offer-list";
import { MergeForm, ProductForm } from "@/components/admin/product-forms";
import { Badge, Facts, NoticeBanner, PageHeader, Panel } from "@/components/admin/ui";
import { ProductImage } from "@/components/product/product-image";

export async function generateMetadata({ params }: PageProps<"/[lang]/admin/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getAdminProduct(id);
  return { title: detail?.product.title };
}

export default async function AdminProductPage({ params, searchParams }: PageProps<"/[lang]/admin/products/[id]">) {
  const { id } = await params;
  const notice = param(await searchParams, "notice");
  const i18n = await getAdminI18n();
  const { a, href, money, dateTime } = i18n;
  const [detail, stores, history, publishedAt] = await Promise.all([
    getAdminProduct(id),
    listStoreChoices(),
    listAdminEvents({ entityType: "product", entityId: id }, 1, 20),
    lastPublishedAt(),
  ]);
  if (!detail) notFound();

  const { product, offers, deal, mergedInto, duplicates } = detail;
  const d = a.products.detail;
  const lockedNames = product.lockedFields
    .map((field) => d.lockedFields[field as keyof typeof d.lockedFields])
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader
        back={{ href: href("/admin/products"), label: d.back }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="min-w-0">{product.title}</span>
            {mergedInto ? (
              <Badge>{a.products.badges.merged}</Badge>
            ) : !product.active ? (
              <Badge tone="bad">{a.products.badges.off}</Badge>
            ) : null}
            {deal && <Badge tone="good">{a.products.badges.deal}</Badge>}
          </span>
        }
        intro={
          product.active ? (
            <a
              href={href(`/product/${product.slug}`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              {a.common.viewOnSite}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : undefined
        }
        actions={
          !mergedInto && (
            <ActionButton
              action={setProductActiveAction}
              fields={{ id: product.id, active: String(!product.active) }}
              variant={product.active ? "secondary" : "primary"}
            >
              {product.active ? a.common.switchOff : a.common.switchOn}
            </ActionButton>
          )
        }
      />

      <div className="mb-4 space-y-2">
        {(notice === "created" || notice === "merged") && <NoticeBanner>{a.notices[notice]}</NoticeBanner>}
        {mergedInto && (
          <NoticeBanner tone="bad">
            {d.mergedInto}{" "}
            <Link href={href(`/admin/products/${mergedInto.id}`)} className="underline">
              {mergedInto.title}
            </Link>
          </NoticeBanner>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Panel title={d.details}>
            {lockedNames && (
              <p className="mb-4 rounded-lg bg-global-soft px-3 py-2 text-xs text-global">
                {fmt(d.lockedNote, { fields: lockedNames })}
              </p>
            )}
            <ProductForm
              product={{
                id: product.id,
                title: product.title,
                brand: product.brand,
                gtin: product.gtin,
                imageUrl: product.imageUrl,
                weightKg: product.weightKg,
                categorySlug: product.categorySlug,
                subcategorySlug: product.subcategorySlug,
                audience: product.audience,
                lockedFields: product.lockedFields,
              }}
            />
          </Panel>

          <Panel title={`${d.offers} (${offers.length})`} flush>
            <OfferList
              productId={product.id}
              offers={offers}
              stores={stores}
              dates={Object.fromEntries(offers.map((offer) => [offer.id, dateTime(offer.lastSeenAt)]))}
            />
          </Panel>

          <Panel title={d.history} flush>
            <ActivityList events={history.events} i18n={i18n} publishedAt={publishedAt} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <div className="aspect-square overflow-hidden rounded-xl border border-line bg-white">
              {isCategorySlug(product.categorySlug) && (
                <ProductImage imageUrl={product.imageUrl} title={product.title} category={product.categorySlug} />
              )}
            </div>
            <div className="mt-4">
              <Facts
                items={[
                  { label: d.status, value: product.active ? d.isOn : d.isOff },
                  {
                    label: a.products.badges.deal,
                    value: deal
                      ? fmt(d.deal, {
                          price: money(deal.landedMinor),
                          pct: Math.round(deal.realDiscountPct),
                          kind: deal.verified ? d.verified : d.unverified,
                        })
                      : d.noDeal,
                  },
                  { label: d.slug, value: <span className="break-all font-mono text-xs">{product.slug}</span> },
                  { label: d.created, value: dateTime(product.createdAt) },
                ]}
              />
            </div>
          </Panel>

          {duplicates.length > 0 && (
            <Panel title={d.duplicates}>
              <ul className="space-y-1 text-sm">
                {duplicates.map((duplicate) => (
                  <li key={duplicate.id}>
                    <Link href={href(`/admin/products/${duplicate.id}`)} className="hover:underline">
                      {duplicate.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {!mergedInto && (
            <Panel title={a.products.merge.title}>
              <MergeForm productId={product.id} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
