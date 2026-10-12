import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/modules/auth/session";
import { productForMessage } from "@/modules/messages/service";
import { NewMessageForm } from "@/components/messages/new-message-form";
import { SignInPrompt } from "@/components/messages/sign-in-prompt";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.messages.newTitle, robots: { index: false } };
}

export default async function NewMessagePage({ searchParams }: PageProps<"/[lang]/messages/new">) {
  const { t, href } = await getI18n();
  const { product: slug } = await searchParams;
  const productSlug = typeof slug === "string" ? slug : undefined;
  const self = href("/messages/new") + (productSlug ? `?product=${encodeURIComponent(productSlug)}` : "");

  const user = await getCurrentUser();
  if (!user) {
    return (
      <Container className="py-12">
        <SignInPrompt next={self} />
      </Container>
    );
  }

  const product = productSlug ? await productForMessage(productSlug) : null;
  return (
    <Container className="max-w-4xl py-8">
      <Link href={href("/messages")} className="text-sm font-semibold text-muted hover:text-ink">
        ← {t.messages.allConversations}
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{t.messages.newTitle}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t.messages.newIntro}</p>
      <div className="mt-6">
        <NewMessageForm product={product && { slug: product.slug, title: product.title }} defaultPhone={user.phone ?? ""} />
      </div>
    </Container>
  );
}
