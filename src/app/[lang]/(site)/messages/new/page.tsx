import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/modules/auth/session";
import { sanitizeCart } from "@/modules/cart/items";
import { waitingRequestOf } from "@/modules/messages/service";
import { NewMessageForm } from "@/components/messages/new-message-form";
import { SignInPrompt } from "@/components/messages/sign-in-prompt";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.messages.newTitle, robots: { index: false } };
}

/**
 * Write to us: a new request. `?offer=<id>` attaches that listing ("Order with
 * our help" on a product page); `?cart=1` opens the cart's parcels to pick from.
 */
export default async function NewMessagePage({ searchParams }: PageProps<"/[lang]/messages/new">) {
  const { t, href } = await getI18n();
  const { offer, cart } = await searchParams;
  const query = new URLSearchParams();
  if (typeof offer === "string") query.set("offer", offer);
  if (cart === "1") query.set("cart", "1");
  const self = href("/messages/new") + (query.size ? `?${query}` : "");

  const user = await getCurrentUser();
  if (!user) {
    return (
      <Container className="py-12">
        <SignInPrompt next={self} />
      </Container>
    );
  }

  const m = t.messages;
  // One request at a time: the next one waits until we have answered.
  const waiting = await waitingRequestOf(user.id);
  return (
    <Container className="max-w-4xl py-8">
      <Link href={href("/messages")} className="text-sm font-semibold text-muted hover:text-ink">
        ← {m.allConversations}
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{m.newTitle}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{m.newIntro}</p>
      <div className="mt-6">
        {waiting ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-global/30 bg-global-soft p-5">
            <p className="flex max-w-xl items-start gap-2.5 text-sm">
              <Clock className="mt-0.5 size-4 shrink-0 text-global" aria-hidden />
              {m.waitingExists}
            </p>
            <ButtonLink href={href(`/messages/${waiting.id}`)}>{m.openWaiting}</ButtonLink>
          </div>
        ) : (
          <NewMessageForm
            initialItems={typeof offer === "string" ? sanitizeCart([{ offerId: offer, quantity: 1 }]) : []}
            openCart={cart === "1"}
            defaultPhone={user.phone ?? ""}
          />
        )}
      </div>
    </Container>
  );
}
