import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isCategorySlug } from "@/config/categories";
import { getI18n } from "@/i18n/server";
import { DealsExplorer } from "@/components/deals/deals-explorer";
import { FollowButton } from "@/components/follows/follow-button";

export async function generateMetadata({ params }: PageProps<"/[lang]/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (!isCategorySlug(slug)) return {};
  const { t } = await getI18n();
  return { title: t.categories[slug].name, description: t.categories[slug].description };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/[lang]/category/[slug]">) {
  const { slug } = await params;
  if (!isCategorySlug(slug)) notFound();
  const { t } = await getI18n();

  return (
    <DealsExplorer
      title={t.categories[slug].name}
      subtitle={t.categories[slug].description}
      searchParams={await searchParams}
      basePath={`/category/${slug}`}
      lockedCategory={slug}
      action={<FollowButton kind="category" value={slug} name={t.categories[slug].name} />}
    />
  );
}
