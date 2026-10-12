import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Plus } from "lucide-react";
import { LOCALE_TAGS } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/modules/auth/session";
import { listUserConversations } from "@/modules/messages/service";
import { SignInPrompt } from "@/components/messages/sign-in-prompt";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.messages.title, robots: { index: false } };
}

export default async function MessagesPage() {
  const { t, href, locale, market } = await getI18n();
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Container className="py-12">
        <SignInPrompt next={href("/messages")} />
      </Container>
    );
  }

  const m = t.messages;
  const conversations = await listUserConversations(user.id);
  const when = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { dateStyle: "medium", timeStyle: "short", timeZone: market.timeZone });

  return (
    <Container className="max-w-3xl py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight">{m.title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{m.intro}</p>
        </div>
        <ButtonLink href={href("/messages/new")}>
          <Plus className="size-4" aria-hidden />
          {m.newMessage}
        </ButtonLink>
      </div>

      {conversations.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <MessageCircle className="size-8 text-muted" aria-hidden />
          <p className="mt-3 max-w-sm text-sm text-muted">{m.empty}</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={href(`/messages/${conversation.id}`)}
                className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
              >
                <span
                  aria-hidden
                  className={cn("mt-2 size-2 shrink-0 rounded-full", conversation.unread ? "bg-deal" : "bg-transparent")}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={cn("truncate text-sm", conversation.unread ? "font-bold" : "font-semibold")}>
                      {conversation.subject}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{when.format(conversation.lastMessageAt)}</span>
                  </span>
                  {conversation.preview && (
                    <span className="mt-0.5 block truncate text-sm text-muted">
                      {conversation.preview.sender === "admin" ? m.adminName : m.you}: {conversation.preview.body}
                    </span>
                  )}
                  <span className="mt-1 flex gap-2 text-xs">
                    {conversation.unread && <span className="font-semibold text-deal">{m.unread}</span>}
                    {conversation.status === "closed" && <span className="text-muted">{m.statusClosed}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
