import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Lock, Package } from "lucide-react";
import { LOCALE_TAGS } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/modules/auth/session";
import { isUnread } from "@/modules/messages/rules";
import { getOwnConversation, listMessages, markReadByUser } from "@/modules/messages/service";
import { LiveRefresh } from "@/components/messages/live-refresh";
import { MessageThread } from "@/components/messages/message-thread";
import { RequestDetails } from "@/components/messages/request-details";
import { ButtonLink } from "@/components/ui/button";
import { ReplyForm } from "@/components/messages/reply-form";
import { SignInPrompt } from "@/components/messages/sign-in-prompt";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.messages.title, robots: { index: false } };
}

export default async function ConversationPage({ params }: PageProps<"/[lang]/messages/[id]">) {
  const { id } = await params;
  const { t, href, locale, market, money } = await getI18n();
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Container className="py-12">
        <SignInPrompt next={href(`/messages/${id}`)} />
      </Container>
    );
  }

  const conversation = await getOwnConversation(user.id, id);
  if (!conversation) notFound();
  const messages = await listMessages(conversation.id);
  const hadUnread = isUnread(conversation.lastAdminMessageAt, conversation.userReadAt);
  if (hadUnread) await markReadByUser(conversation.id);

  const m = t.messages;
  const when = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { dateStyle: "medium", timeStyle: "short", timeZone: market.timeZone });

  return (
    <Container className="max-w-3xl py-8">
      <LiveRefresh now={hadUnread} />
      <Link href={href("/messages")} className="text-sm font-semibold text-muted hover:text-ink">
        ← {m.allConversations}
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{conversation.subject}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span
          className={
            conversation.status === "open"
              ? "font-semibold text-brand-strong"
              : conversation.status === "waiting"
                ? "font-semibold text-global"
                : "text-muted"
          }
        >
          {conversation.status === "open" ? m.statusOpen : conversation.status === "waiting" ? m.statusWaiting : m.statusClosed}
        </span>
        {conversation.productSlug && conversation.productTitle && (
          <Link
            href={href(`/product/${conversation.productSlug}`)}
            className="inline-flex min-w-0 items-center gap-1.5 text-muted hover:text-ink"
          >
            <Package className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{conversation.productTitle}</span>
          </Link>
        )}
      </div>

      {conversation.details && (
        <div className="mt-6">
          <RequestDetails
            details={conversation.details}
            money={(amount) => money(amount)}
            productHref={(slug) => href(`/product/${slug}`)}
            labels={{
              title: m.orderDetails,
              parcelFrom: t.cart.parcelFrom,
              estimatedTotal: m.estimatedTotal,
              fee: t.order.lineFee,
              note: t.order.estimateNote,
            }}
          />
        </div>
      )}

      <div className="mt-6">
        <MessageThread
          items={messages.map((message) => ({
            id: message.id,
            mine: message.sender === "user",
            author: message.sender === "user" ? m.you : m.adminName,
            time: when.format(message.createdAt),
            body: message.body,
          }))}
        />
      </div>

      <div className="mt-6">
        {conversation.status === "open" && <ReplyForm conversationId={conversation.id} />}
        {conversation.status === "waiting" && (
          <p className="flex items-start gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            <Clock className="mt-0.5 size-4 shrink-0 text-global" aria-hidden />
            {m.waitingNote}
          </p>
        )}
        {conversation.status === "closed" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-muted">
              <Lock className="size-4 shrink-0" aria-hidden />
              {m.closedNote}
            </p>
            <ButtonLink href={href("/messages/new")} size="sm">
              {m.newMessageAgain}
            </ButtonLink>
          </div>
        )}
      </div>
    </Container>
  );
}
