import type { Metadata } from "next";
import { Check } from "lucide-react";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { toMinor } from "@/lib/money";
import { OrderSteps } from "@/components/orders/steps";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.order.helpTitle, description: t.order.helpIntro };
}

export default async function OrderingAbroadPage() {
  const { t, href, money, market } = await getI18n();
  const { feeRate, minFee } = market.assistedOrder;
  const notes = [t.order.goodToKnow1, t.order.goodToKnow2, t.order.goodToKnow3];

  return (
    <Container className="space-y-10 py-10">
      <header className="max-w-3xl">
        <h1 className="text-balance text-4xl font-extrabold tracking-tight">{t.order.helpTitle}</h1>
        <p className="mt-3 text-lg text-muted">{t.order.helpIntro}</p>
      </header>

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">{t.order.stepsTitle}</h2>
        <OrderSteps t={t} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-xl font-bold">{t.order.feeTitle}</h2>
          <p className="mt-2 leading-7 text-muted">
            {fmt(t.order.feeText, { rate: Math.round(feeRate * 1000) / 10, min: money(toMinor(minFee)) })}
          </p>
        </section>
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-xl font-bold">{t.order.goodToKnowTitle}</h2>
          <ul className="mt-3 space-y-2.5">
            {notes.map((note) => (
              <li key={note} className="flex items-start gap-2.5 text-sm leading-6 text-muted">
                <Check className="mt-1 size-4 shrink-0 text-brand" aria-hidden />
                {note}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <ButtonLink href={`${href("/deals")}?scope=global`}>{t.order.browseAbroad}</ButtonLink>
    </Container>
  );
}
