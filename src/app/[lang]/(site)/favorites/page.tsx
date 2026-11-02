import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { FavoritesList } from "@/components/favorites/favorites-list";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.favorites.title, robots: { index: false } };
}

/** Saved products. The list lives in the browser, so the page is client-rendered. */
export default async function FavoritesPage() {
  const { t } = await getI18n();
  return (
    <Container className="space-y-4 py-2 md:space-y-6 md:py-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t.favorites.title}</h1>
        <p className="mt-1 text-sm text-muted md:text-base">{t.favorites.intro}</p>
      </header>
      <FavoritesList />
    </Container>
  );
}
