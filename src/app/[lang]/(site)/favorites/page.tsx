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
    <Container className="space-y-6 py-10">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight">{t.favorites.title}</h1>
        <p className="mt-1 text-muted">{t.favorites.intro}</p>
      </header>
      <FavoritesList />
    </Container>
  );
}
