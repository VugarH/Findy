import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { ParcelPlanner } from "@/components/cart/parcel-planner";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.cart.title, robots: { index: false } };
}

/** The cart, planned as parcels (modules/cart). The cart itself lives in the browser, so the page is client-rendered. */
export default async function CartPage() {
  const { t } = await getI18n();
  return (
    <Container className="space-y-4 py-2 md:space-y-6 md:py-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t.cart.title}</h1>
        <p className="mt-1 text-sm text-muted md:text-base">{t.cart.intro}</p>
      </header>
      <ParcelPlanner />
    </Container>
  );
}
