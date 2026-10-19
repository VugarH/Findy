import type { Metadata } from "next";
import { CircleCheck, CircleX } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { verifyEmail } from "@/modules/auth/email-links";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.email.verify.heading, robots: { index: false } };
}

/** Opened from the confirmation email: confirms the address, once. */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/[lang]/verify-email">) {
  const { t, href } = await getI18n();
  const { token } = await searchParams;
  const ok = typeof token === "string" && (await verifyEmail(token));
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <Container className="grid place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
        <Icon className={ok ? "mx-auto size-10 text-brand" : "mx-auto size-10 text-deal"} aria-hidden />
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{ok ? t.auth.verifyOkTitle : t.auth.verifyBadTitle}</h1>
        <p className="mt-2 text-sm text-muted">{ok ? t.auth.verifyOkText : t.auth.verifyBadText}</p>
        <ButtonLink href={href("/account")} className="mt-6">
          {t.auth.toAccount}
        </ButtonLink>
      </div>
    </Container>
  );
}
