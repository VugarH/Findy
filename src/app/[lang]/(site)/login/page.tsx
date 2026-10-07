import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/modules/auth/session";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.signIn, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  const { t, href } = await getI18n();
  if (await getCurrentUser()) redirect(href("/"));

  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";

  return (
    <AuthCard
      title={t.auth.signInTitle}
      subtitle={t.auth.signInSubtitle}
      footer={{ text: t.auth.noAccount, linkLabel: t.auth.register, href: href("/register") + query }}
    >
      <LoginForm next={nextPath} />
    </AuthCard>
  );
}
