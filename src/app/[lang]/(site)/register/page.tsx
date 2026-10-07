import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/modules/auth/session";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.register, robots: { index: false } };
}

export default async function RegisterPage({ searchParams }: PageProps<"/[lang]/register">) {
  const { t, href } = await getI18n();
  if (await getCurrentUser()) redirect(href("/"));

  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";

  return (
    <AuthCard
      title={t.auth.registerTitle}
      subtitle={t.auth.registerSubtitle}
      footer={{ text: t.auth.haveAccount, linkLabel: t.auth.signIn, href: href("/login") + query }}
    >
      <RegisterForm next={nextPath} />
    </AuthCard>
  );
}
