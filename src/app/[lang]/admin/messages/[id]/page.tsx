import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { isLocale, LOCALE_LABELS } from "@/i18n/config";
import { setConversationStatusAction } from "@/modules/admin/actions/messages";
import { getAdminI18n } from "@/modules/admin/i18n";
import { fmt } from "@/i18n/format";
import { isUnread } from "@/modules/messages/rules";
import { getConversation, getCustomerDetails, listMessages, markReadByAdmin } from "@/modules/messages/service";
import { ActionButton } from "@/components/admin/action-button";
import { AdminReplyForm } from "@/components/admin/admin-reply-form";
import { Badge, Facts, PageHeader, Panel } from "@/components/admin/ui";
import { LiveRefresh } from "@/components/messages/live-refresh";
import { MessageThread } from "@/components/messages/message-thread";
import { RequestDetails } from "@/components/messages/request-details";

export async function generateMetadata(): Promise<Metadata> {
  const { a } = await getAdminI18n();
  return { title: a.nav.messages };
}

const PhoneLink = ({ phone, label }: { phone: string; label: string }) => (
  <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 text-brand-strong hover:underline" title={label}>
    <Phone className="size-3.5" aria-hidden />
    {phone}
  </a>
);

/** One conversation: the thread and reply box, with who the person is beside it. */
export default async function AdminConversationPage({ params }: PageProps<"/[lang]/admin/messages/[id]">) {
  const { id } = await params;
  const { a, href, dateTime, date, money } = await getAdminI18n();
  const conversation = await getConversation(id);
  if (!conversation) notFound();
  const [messages, customer] = await Promise.all([
    listMessages(conversation.id),
    getCustomerDetails(conversation.userId, conversation.id),
  ]);
  const hadUnread = isUnread(conversation.lastUserMessageAt, conversation.adminReadAt);
  if (hadUnread) await markReadByAdmin(conversation.id);
  const m = a.messages;
  const name = customer?.fullName ?? m.customer;
  const closed = conversation.status === "closed";

  return (
    <>
      <LiveRefresh now={hadUnread} />
      <PageHeader
        back={{ href: href("/admin/messages"), label: m.back }}
        title={conversation.subject}
        actions={
          <>
            <Badge tone={closed ? "neutral" : conversation.status === "waiting" ? "info" : "good"}>
              {m.status[conversation.status]}
            </Badge>
            <ActionButton
              action={setConversationStatusAction}
              fields={{ id: conversation.id, status: closed ? "open" : "closed" }}
              variant={closed ? "secondary" : "primary"}
            >
              {closed ? m.reopen : m.close}
            </ActionButton>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {conversation.details && (
            <RequestDetails
              details={conversation.details}
              money={(amount) => money(amount)}
              productHref={(slug) => href(`/product/${slug}`)}
              labels={{
                title: m.orderDetails,
                parcelFrom: m.parcelFrom,
                estimatedTotal: m.estimatedTotal,
                fee: m.serviceFee,
                note: m.pricedAt,
              }}
            />
          )}
          <MessageThread
            items={messages.map((message) => ({
              id: message.id,
              mine: message.sender === "admin",
              author: message.sender === "admin" ? fmt(m.sentBy, { email: message.adminEmail ?? "—" }) : name,
              time: dateTime(message.createdAt),
              body: message.body,
            }))}
          />
          <AdminReplyForm conversationId={conversation.id} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Panel title={m.customer}>
            {customer ? (
              <Facts
                items={[
                  { label: m.customer, value: customer.fullName },
                  {
                    label: m.email,
                    value: (
                      <a href={`mailto:${customer.email}`} className="hover:underline">
                        {customer.email}
                      </a>
                    ),
                  },
                  {
                    label: m.phoneGiven,
                    value: conversation.contactPhone ? <PhoneLink phone={conversation.contactPhone} label={m.call} /> : m.none,
                  },
                  { label: m.city, value: conversation.city ?? m.none },
                  {
                    label: m.accountPhone,
                    value: customer.phone ? <PhoneLink phone={customer.phone} label={m.call} /> : m.none,
                  },
                  { label: m.language, value: isLocale(customer.locale) ? LOCALE_LABELS[customer.locale] : customer.locale },
                  { label: m.telegram, value: customer.telegramConnected ? m.connected : m.notConnected },
                  { label: m.memberSince, value: date(customer.createdAt) },
                  { label: m.lastLogin, value: dateTime(customer.lastLoginAt) },
                  {
                    label: m.orderRequests,
                    value:
                      customer.orderRequests > 0 ? (
                        <Link href={href("/admin/orders")} className="hover:underline">
                          {customer.orderRequests}
                        </Link>
                      ) : (
                        m.none
                      ),
                  },
                ]}
              />
            ) : (
              <p className="text-sm text-muted">{m.none}</p>
            )}
          </Panel>

          {conversation.productTitle && (
            <Panel title={m.product}>
              {conversation.productId ? (
                <Link href={href(`/admin/products/${conversation.productId}`)} className="text-sm font-medium hover:underline">
                  {conversation.productTitle}
                </Link>
              ) : (
                <p className="text-sm">{conversation.productTitle}</p>
              )}
              {conversation.productSlug && (
                <a
                  href={href(`/product/${conversation.productSlug}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs text-muted hover:underline"
                >
                  {href(`/product/${conversation.productSlug}`)}
                </a>
              )}
            </Panel>
          )}

          {customer && customer.otherConversations.length > 0 && (
            <Panel title={m.otherConversations} flush>
              <ul className="divide-y divide-line">
                {customer.otherConversations.map((other) => (
                  <li key={other.id}>
                    <Link href={href(`/admin/messages/${other.id}`)} className="block px-5 py-2.5 text-sm hover:bg-surface-2/50">
                      <span className="block truncate font-medium">{other.subject}</span>
                      <span className="text-xs text-muted">
                        {m.status[other.status]} · {dateTime(other.lastMessageAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
