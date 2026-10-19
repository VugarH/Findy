import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.forgotTitle, robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const { t, href } = await getI18n();
  return (
    <AuthCard
      title={t.auth.forgotTitle}
      subtitle={t.auth.forgotSubtitle}
      footer={{ text: t.auth.rememberPassword, linkLabel: t.auth.backToSignIn, href: href("/login") }}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
