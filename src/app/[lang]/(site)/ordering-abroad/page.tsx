import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { fmt } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { toMinor } from "@/lib/money";
import { OrderFaq } from "@/components/orders/faq";
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

  return (
    <Container className="space-y-10 py-10">
      <header className="max-w-3xl">
        <h1 className="text-balance text-4xl font-extrabold tracking-tight">{t.order.helpTitle}</h1>
        <p className="mt-3 text-lg text-muted">{t.order.helpIntro}</p>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-global/30 bg-global-soft p-6">
        <div className="min-w-0 max-w-2xl">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <MessageCircle className="size-5 text-global" aria-hidden />
            {t.messages.helpCtaTitle}
          </h2>
          <p className="mt-1.5 leading-7 text-ink/80">{t.messages.helpCtaText}</p>
        </div>
        <ButtonLink href={href("/messages/new")}>{t.messages.writeToUs}</ButtonLink>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">{t.order.stepsTitle}</h2>
        <OrderSteps t={t} />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-xl font-bold">{t.order.feeTitle}</h2>
        <p className="mt-2 max-w-3xl leading-7 text-muted">
          {fmt(t.order.feeText, { rate: Math.round(feeRate * 1000) / 10, min: money(toMinor(minFee)) })}
        </p>
      </section>

      <OrderFaq t={t} market={market} money={money} />

      <ButtonLink href={`${href("/deals")}?scope=global`} variant="secondary">
        {t.order.browseAbroad}
      </ButtonLink>
    </Container>
  );
}
