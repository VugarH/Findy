import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.resetTitle, robots: { index: false } };
}

/** Opened from the emailed link. The token is checked when the form is sent, so opening the page uses nothing up. */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/[lang]/reset-password">) {
  const { t, href } = await getI18n();
  const { token } = await searchParams;
  return (
    <AuthCard
      title={t.auth.resetTitle}
      subtitle={t.auth.resetSubtitle}
      footer={{ text: t.auth.rememberPassword, linkLabel: t.auth.backToSignIn, href: href("/login") }}
    >
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </AuthCard>
  );
}
